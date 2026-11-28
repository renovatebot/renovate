import semver from 'semver';
import { z } from 'zod/v4';
import { getConfig } from '../../../lib/config/defaults.ts';
import { regEx } from '../../../lib/util/regex.ts';
import { Json } from '../../../lib/util/schema-utils/index.ts';
import type { StaticDataSource } from '../types.ts';
import { fetchText } from '../utils.ts';

const actionsLockfileModule = 'github.com/github/actions-lockfile/go';
const schemaVariablePattern = String.raw`schemaV\d+`;

const LockfileJson = z.looseObject({
  $schema: z.literal('https://json-schema.org/draft/2020-12/schema'),
  $id: z.string(),
  type: z.literal('object'),
  additionalProperties: z.literal(false),
  required: z.array(z.string()),
  properties: z.looseObject({
    version: z.looseObject({ const: z.string() }),
    workflows: z.looseObject({
      type: z.literal('object'),
      additionalProperties: z.looseObject({
        type: z.literal('array'),
        items: z.unknown(),
      }),
    }),
  }),
});

interface RawActionsLockfileSchemas {
  cliVersion: string;
  moduleVersion: string;
  schemaVersion: string;
  schemas: Record<string, string>;
}

interface ActionsLockfileSchemas {
  versions: {
    cli: string;
    module: string;
    schema: string;
  };
  schemas: Record<string, z.infer<typeof LockfileJson>>;
}

function extractMatch(
  content: string,
  pattern: RegExp,
  group: string,
  description: string,
): string {
  const match = pattern.exec(content)?.groups?.[group];
  if (!match) {
    throw new Error(`Could not find ${description}`);
  }
  return match;
}

function extractModuleVersion(goMod: string): string {
  return extractMatch(
    goMod,
    regEx(
      `^\\s*(?:require\\s+)?${actionsLockfileModule.replaceAll('.', '\\.')}${String.raw`\s+(?<version>v\S+)(?:\s+\/\/.*)?$`}`,
      'm',
    ),
    'version',
    `${actionsLockfileModule} version in gh-actions-lock go.mod`,
  );
}

function extractSchemaVersions(schemaSource: string): {
  current: string;
  supported: string[];
} {
  const currentVariable = extractMatch(
    schemaSource,
    regEx(
      String.raw`func Schema\(\) string \{\s*return (?<variable>${schemaVariablePattern})\s*\}`,
    ),
    'variable',
    'current schema in actions-lockfile Schema()',
  );

  const versionsByVariable = new Map<string, string>();
  const cases = schemaSource.matchAll(
    regEx(
      String.raw`case "(?<version>v\d+\.\d+\.\d+)":\s*return (?<variable>${schemaVariablePattern}), true`,
      'g',
    ),
  );
  for (const { groups } of cases) {
    const { variable, version } = groups!;
    versionsByVariable.set(variable, version);
  }

  const current = versionsByVariable.get(currentVariable);
  if (!current) {
    throw new Error(`Could not resolve current schema ${currentVariable}`);
  }

  return {
    current,
    supported: [...versionsByVariable.values()].sort(semver.compare),
  };
}

export const githubActionsLockfile: StaticDataSource<
  RawActionsLockfileSchemas,
  ActionsLockfileSchemas
> = {
  name: 'github-actions-lockfile',
  file: 'lib/data/github-actions-lockfile.json',
  fetch: async () => {
    const cliVersion = z.string().parse(getConfig().constraints?.ghActionsLock);
    const cliRoot = `https://raw.githubusercontent.com/github/gh-actions-lock/${cliVersion}`;
    const moduleVersion = extractModuleVersion(
      await fetchText(`${cliRoot}/go.mod`),
    );
    const moduleRoot = `https://raw.githubusercontent.com/github/actions-lockfile/go/${moduleVersion}`;
    const { current: schemaVersion, supported: schemaVersions } =
      extractSchemaVersions(
        await fetchText(`${moduleRoot}/go/pkg/lockfile/schema.go`),
      );
    const schemas = Object.fromEntries(
      await Promise.all(
        schemaVersions.map(async (version) => [
          version,
          await fetchText(`${moduleRoot}/schema/lockfile-${version}.json`),
        ]),
      ),
    );

    return { cliVersion, moduleVersion, schemaVersion, schemas };
  },
  generate: ({ cliVersion, moduleVersion, schemaVersion, schemas }) => ({
    versions: {
      cli: cliVersion,
      module: moduleVersion,
      schema: schemaVersion,
    },
    schemas: Object.fromEntries(
      Object.entries(schemas).map(([version, schema]) => [
        version,
        Json.pipe(LockfileJson).parse(schema),
      ]),
    ),
  }),
  commitMessage: (_before, after) => ({
    subject: `update GitHub Actions lockfile schema to ${after.versions.schema}`,
  }),
};
