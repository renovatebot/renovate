import type { ValidateFunction } from 'ajv';
import { Ajv } from 'ajv';
import _addFormats from 'ajv-formats';
import { getOptions } from '../../../lib/config/options/index.ts';
import type {
  RenovateOptions,
  RenovateStringOption,
} from '../../../lib/config/types.ts';
import { allManagersList } from '../../../lib/modules/manager/index.ts';
import { partial } from '../../../test/util.ts';
import type { DocsHeadings } from '../schema.ts';
import {
  buildSchema,
  getOptionDocsUrl,
  readAllDocsHeadings,
} from '../schema.ts';

const addFormats = _addFormats as unknown as typeof _addFormats.default;

const managers = new Set<string>(allManagersList);

function option(overrides: Partial<RenovateStringOption>): RenovateOptions {
  return partial<RenovateStringOption>({
    name: 'anOption',
    description: 'A description',
    type: 'string',
    ...overrides,
  });
}

function headings(repo: string[], global: string[] = []): DocsHeadings {
  return { repo: new Set(repo), global: new Set(global) };
}

async function compileSchema(
  opts: { isGlobal?: boolean } = {},
): Promise<ValidateFunction> {
  const ajv = new Ajv({ schemaId: '$id', strict: false });
  addFormats(ajv);
  return ajv.compile(await buildSchema(opts));
}

/**
 * Every error a schema reports for a config, so a test can show what someone would be told, rather than only that it was rejected.
 */
function schemaErrors(
  validate: ValidateFunction,
  config: unknown,
): string[] | undefined {
  return validate(config)
    ? undefined
    : validate.errors?.map((error) => error.message ?? 'unknown error');
}

function toAnchors(docsHeadings: Set<string>): Set<string> {
  return new Set(
    [...docsHeadings].map((heading) =>
      heading.replaceAll('.', '').toLowerCase(),
    ),
  );
}

async function getLinksToMissingHeadings(): Promise<string[]> {
  const docsHeadings = await readAllDocsHeadings();
  const anchors = {
    'configuration-options': toAnchors(docsHeadings.repo),
    'self-hosted-configuration': toAnchors(docsHeadings.global),
  };

  return (
    getOptions()
      /* managers are documented in their own module pages, not in the config pages */
      .filter((o) => !managers.has(o.name))
      .map((o) => [o.name, getOptionDocsUrl(o, docsHeadings)] as const)
      .filter(([, url]) => {
        const [page, anchor] = url
          .replace('https://docs.renovatebot.com/', '')
          .split('/#');
        return !anchors[page as keyof typeof anchors].has(anchor);
      })
      .map(([name, url]) => `${name} -> ${url}`)
      .toSorted()
  );
}

describe('tools/docs/test/schema', () => {
  describe('getOptionDocsUrl', () => {
    it('links an option with no parents to its own heading', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'automerge' }),
          headings(['automerge']),
        ),
      ).toBe('https://docs.renovatebot.com/configuration-options/#automerge');
    });

    it('links a child option to the heading under its parent', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'commands', parents: ['postUpgradeTasks'] }),
          headings(['postUpgradeTasks.commands']),
        ),
      ).toBe(
        'https://docs.renovatebot.com/configuration-options/#postupgradetaskscommands',
      );
    });

    it('links a global option to the self-hosted page', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'onboarding', globalOnly: true }),
          headings(['onboarding'], ['onboarding']),
        ),
      ).toBe(
        'https://docs.renovatebot.com/self-hosted-configuration/#onboarding',
      );
    });

    it('links an option which is valid in several places to the heading which documents it', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'enabled', parents: ['.', 'packageRules', 'npm'] }),
          headings(['enabled']),
        ),
      ).toBe('https://docs.renovatebot.com/configuration-options/#enabled');
    });

    it('skips the parents which do not document the option', () => {
      expect(
        getOptionDocsUrl(
          option({
            name: 'managerFilePatterns',
            parents: ['ansible', 'npm'],
          }),
          headings(['managerFilePatterns']),
        ),
      ).toBe(
        'https://docs.renovatebot.com/configuration-options/#managerfilepatterns',
      );
    });

    it('falls back to the first parent when the option is undocumented', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'undocumented', parents: ['.', 'packageRules'] }),
          headings([]),
        ),
      ).toBe(
        'https://docs.renovatebot.com/configuration-options/#packagerulesundocumented',
      );
    });
  });

  describe('object options', () => {
    let repoSchema: ValidateFunction;
    let globalSchema: ValidateFunction;

    beforeAll(async () => {
      repoSchema = await compileSchema();
      globalSchema = await compileSchema({ isGlobal: true });
    });

    it('allows a map of values to use any key', () => {
      /* `secrets` is self-hosted only, so is only in the global schema */
      expect(
        schemaErrors(globalSchema, { secrets: { enabled: 'a-secret' } }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          registryAliases: { labels: 'https://example.com' },
        }),
      ).toBeUndefined();
    });

    it('validates the values of a map', () => {
      expect(
        schemaErrors(globalSchema, { secrets: { MY_TOKEN: 123 } }),
      ).toEqual(['must be string']);

      expect(
        schemaErrors(repoSchema, { registryAliases: { docker: 123 } }),
      ).toEqual(['must be string']);
    });

    it('allows an environment variable named after a config option', () => {
      expect(
        schemaErrors(repoSchema, { env: { automerge: 'true' } }),
      ).toBeUndefined();

      expect(schemaErrors(repoSchema, { env: { GOPROXY: 123 } })).toEqual([
        'must be string',
      ]);
    });

    it('validates the keys of an object whose keys are a known set', () => {
      expect(
        schemaErrors(repoSchema, {
          statusCheckNames: { artifactError: 'renovate/artifacts' },
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, { statusCheckNames: { bogusCheck: 'x' } }),
      ).toEqual(['must NOT have additional properties']);
    });

    it('validates the values of a map against their allowed values', () => {
      expect(
        schemaErrors(repoSchema, {
          statusCheckWhen: { artifactError: 'failed' },
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          statusCheckWhen: { artifactError: 'sometimes' },
        }),
      ).toEqual(['must be equal to one of the allowed values']);
    });

    it('does not validate the children of an option which nests a config', () => {
      expect(
        schemaErrors(repoSchema, {
          postUpgradeTasks: { commands: 'echo hi' },
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          vulnerabilityAlerts: { vulnerabilityFixStrategy: 'nope' },
        }),
      ).toBeUndefined();
    });

    it('does not validate the children of a map of configs', () => {
      expect(
        schemaErrors(repoSchema, {
          customDatasources: { myDatasource: { format: 'nope' } },
        }),
      ).toBeUndefined();
    });

    it('validates an option which nests a config as a config', () => {
      expect(
        schemaErrors(globalSchema, { force: { automerge: true } }),
      ).toBeUndefined();

      expect(
        schemaErrors(globalSchema, { force: { automerge: 'nope' } }),
      ).toEqual(['must be boolean']);
    });

    it('reports every error when a value matches none of several schemas', () => {
      expect(schemaErrors(repoSchema, { extends: 123 })).toEqual([
        'must be array',
        'must be string',
        'must match exactly one schema in oneOf',
      ]);
    });
  });

  describe('documented options', () => {
    it('links every option to a heading which exists', async () => {
      await expect(getLinksToMissingHeadings()).resolves.toBeEmptyArray();
    });
  });
});
