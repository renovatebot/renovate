import type { ValidateFunction } from 'ajv';
import { Ajv } from 'ajv';
import _addFormats from 'ajv-formats';
import { getOptions } from '../../../lib/config/options/index.ts';
import { groups } from '../../../lib/config/presets/internal/index.ts';
import type {
  ConfigScope,
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

function option(
  overrides: Partial<RenovateStringOption & { scopes: ConfigScope[] }>,
): RenovateOptions {
  return partial<RenovateStringOption & { scopes: ConfigScope[] }>({
    name: 'anOption',
    description: 'A description',
    type: 'string',
    ...overrides,
  });
}

/** a self-hosted option, which doesn't have to say where it can be used */
function globalOption(
  overrides: Partial<RenovateStringOption>,
): RenovateOptions {
  return partial<RenovateStringOption & { globalOnly: true }>({
    name: 'aGlobalOption',
    description: 'A description',
    type: 'string',
    globalOnly: true,
    ...overrides,
  });
}

function headings(repo: string[], global: string[] = []): DocsHeadings {
  return { repo: new Set(repo), global: new Set(global) };
}

const compiledSchemas = new Map<boolean, Promise<ValidateFunction>>();

/**
 * Compiling the full schema takes seconds, so each variant is compiled once and shared by every suite in this file.
 */
function compileSchema({
  isGlobal = false,
}: { isGlobal?: boolean } = {}): Promise<ValidateFunction> {
  let compiled = compiledSchemas.get(isGlobal);
  if (!compiled) {
    compiled = buildSchema({ isGlobal }).then((schema) => {
      const ajv = new Ajv({
        schemaId: '$id',
        strict: false,
        inlineRefs: false,
        code: { optimize: false },
      });
      addFormats(ajv);
      return ajv.compile(schema);
    });
    compiledSchemas.set(isGlobal, compiled);
  }
  return compiled;
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

describe('tools/docs/test/schema', { timeout: 30000 }, () => {
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
          globalOption({ name: 'onboarding' }),
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

    it('links a manager to its own page, even when a config option shares its heading', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'ant', autogenerated: 'manager' }),
          headings(['ant']),
        ),
      ).toBe('https://docs.renovatebot.com/modules/manager/ant/');
    });

    it('fails for an autogenerated option it does not know how to link', () => {
      expect(() =>
        getOptionDocsUrl(
          option({ name: 'npm', autogenerated: 'datasource' as never }),
          headings(['npm']),
        ),
      ).toThrow(
        'Don\'t know where `npm` is documented, as we don\'t handle options autogenerated for `"datasource"`',
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
    }, 30000);

    beforeAll(async () => {
      globalSchema = await compileSchema({ isGlobal: true });
    }, 30000);

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

    it('validates the children of an option which nests a config', () => {
      expect(
        schemaErrors(repoSchema, {
          postUpgradeTasks: { commands: ['echo hi'], executionMode: 'branch' },
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          postUpgradeTasks: { commands: 'echo hi' },
        }),
      ).toEqual(['must be array']);

      expect(
        schemaErrors(repoSchema, {
          vulnerabilityAlerts: { vulnerabilityFixStrategy: 'nope' },
        }),
      ).toEqual(['must be equal to one of the allowed values']);
    });

    it('rejects unknown keys in an option which only has its own children', () => {
      expect(
        schemaErrors(repoSchema, { toolSettings: { jvmMemory: 256 } }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, { toolSettings: { foo: 'bar' } }),
      ).toEqual(['must NOT have additional properties']);

      expect(
        schemaErrors(repoSchema, { postUpgradeTasks: { foo: 'bar' } }),
      ).toEqual(['must NOT have additional properties']);
    });

    it('only allows cache namespaces which exist, or a pattern', () => {
      expect(
        schemaErrors(globalSchema, {
          cacheTtlOverride: {
            'datasource-docker-hub-tags': 90,
            'datasource-maven:metadata-not-found': 60,
            'datasource-releases-npm': 5,
            'datasource-*': 60,
            'datasource-{crate,go}': 90,
            '/^changelog-/': 45,
            '*': 30,
          },
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(globalSchema, {
          // removed in 40.9.0
          cacheTtlOverride: { 'datasource-maven:metadata-xml': 123 },
        }),
      ).toEqual([
        'must be equal to one of the allowed values',
        'must match pattern "^!|^/.*/i?$|[*?[\\]{}()]"',
        'must match a schema in anyOf',
        'property name must be valid',
      ]);

      /* only used by our tests, so shouldn't be suggested to anyone */
      expect(
        schemaErrors(globalSchema, {
          cacheTtlOverride: { '_test-namespace': 123 },
        }),
      ).toEqual([
        'must be equal to one of the allowed values',
        'must match pattern "^!|^/.*/i?$|[*?[\\]{}()]"',
        'must match a schema in anyOf',
        'property name must be valid',
      ]);

      expect(
        schemaErrors(globalSchema, {
          cacheTtlOverride: { 'datasource-docker-hub-tags': 'ninety' },
        }),
      ).toEqual(['must be number']);
    });

    it('validates the children of a map of configs', () => {
      expect(
        schemaErrors(repoSchema, {
          customDatasources: {
            myDatasource: { format: 'json', transformTemplates: ['{}'] },
          },
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          customDatasources: { myDatasource: { format: 'nope' } },
        }),
      ).toEqual(['must be equal to one of the allowed values']);
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
        'must be equal to one of the allowed values',
        'must be string',
        'must match a schema in anyOf',
        'must match exactly one schema in oneOf',
      ]);
    });
  });

  describe('suggested values', () => {
    let repoSchema: ValidateFunction;

    beforeAll(async () => {
      repoSchema = await compileSchema();
    }, 30000);

    it('allows the managers we know about, or a pattern', () => {
      expect(
        schemaErrors(repoSchema, {
          packageRules: [{ matchManagers: ['npm', 'custom.regex'] }],
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          packageRules: [
            { matchManagers: ['/^npm$/', '!npm', 'custom.*', 'pip{,env}'] },
          ],
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          packageRules: [{ matchManagers: 'regex' }],
        }),
      ).toContain('must match exactly one schema in oneOf');

      expect(
        schemaErrors(repoSchema, { packageRules: [{ matchManagers: [123] }] }),
      ).toEqual([
        'must be string',
        'must be equal to one of the allowed values',
        'must be string',
        'must match a schema in anyOf',
        'must be string',
        'must be equal to one of the allowed values',
        'must be string',
        'must match a schema in anyOf',
        'must match exactly one schema in oneOf',
      ]);
    });

    it('suggests the host types we know about, without constraining them', () => {
      expect(
        schemaErrors(repoSchema, {
          hostRules: [{ hostType: 'github', matchHost: 'x' }],
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          hostRules: [{ hostType: 'something-we-do-not-know', matchHost: 'x' }],
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          hostRules: [{ hostType: 123, matchHost: 'x' }],
        }),
      ).toEqual(['must be string']);
    });

    it('suggests the datasources and categories we know about', () => {
      expect(
        schemaErrors(repoSchema, {
          packageRules: [
            { matchDatasources: ['npm'], matchCategories: ['js'] },
          ],
        }),
      ).toBeUndefined();

      expect(
        schemaErrors(repoSchema, {
          packageRules: [{ matchDatasources: ['/^np/'] }],
        }),
      ).toBeUndefined();
    });
  });

  describe('internal presets', () => {
    let repoSchema: ValidateFunction;
    let globalSchema: ValidateFunction;

    beforeAll(async () => {
      repoSchema = await compileSchema();
    }, 30000);

    beforeAll(async () => {
      globalSchema = await compileSchema({ isGlobal: true });
    }, 30000);

    function getPresetsRejectedBySchema(): string[] {
      const rejected: string[] = [];

      for (const [group, presets] of Object.entries(groups)) {
        /* the `global:` presets configure the Renovate instance, so are only valid in a global config */
        const validate = group === 'global' ? globalSchema : repoSchema;

        for (const [name, preset] of Object.entries(presets)) {
          if (!validate(preset)) {
            rejected.push(
              `${group}:${name} -> ${validate.errors?.[0]?.message}`,
            );
          }
        }
      }

      return rejected;
    }

    it('accepts every preset we ship', () => {
      expect(getPresetsRejectedBySchema()).toBeEmptyArray();
    });
  });

  describe('documented options', () => {
    it('links every option to a heading which exists', async () => {
      await expect(getLinksToMissingHeadings()).resolves.toBeEmptyArray();
    });

    it('describes a manager by its display name, and links to its page', async () => {
      const { definitions } = await buildSchema();

      expect(definitions.ant).toMatchObject({
        description:
          'Configuration object for the Apache Ant manager\nSee also: https://docs.renovatebot.com/modules/manager/ant/',
        markdownDescription:
          'Configuration object for the Apache Ant manager\n\nSee also: [ant](https://docs.renovatebot.com/modules/manager/ant/)',
      });
    });
  });
});
