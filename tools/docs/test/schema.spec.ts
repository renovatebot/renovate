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
 * The first error a schema reports for a config, so a test can show what someone would be told, rather than only that it was rejected.
 */
function schemaError(
  validate: ValidateFunction,
  config: unknown,
): string | undefined {
  return validate(config) ? undefined : validate.errors?.[0]?.message;
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

    it('validates a map of values as if it were a nested config', () => {
      /* `secrets` is self-hosted only, so is only in the global schema */
      expect(
        schemaError(globalSchema, { secrets: { enabled: 'a-secret' } }),
      ).toBe('must be boolean');

      expect(
        schemaError(repoSchema, {
          registryAliases: { labels: 'https://example.com' },
        }),
      ).toBe('must be array');

      expect(schemaError(repoSchema, { env: { automerge: 'true' } })).toBe(
        'must be boolean',
      );
    });

    it('does not validate the children of an option which nests a config', () => {
      expect(
        schemaError(repoSchema, { postUpgradeTasks: { commands: 'echo hi' } }),
      ).toBeUndefined();

      expect(
        schemaError(repoSchema, {
          vulnerabilityAlerts: { vulnerabilityFixStrategy: 'nope' },
        }),
      ).toBeUndefined();
    });

    it('does not validate the children of a map of configs', () => {
      expect(
        schemaError(repoSchema, {
          customDatasources: { myDatasource: { format: 'nope' } },
        }),
      ).toBeUndefined();
    });

    it('validates an option which nests a config as a config', () => {
      expect(
        schemaError(globalSchema, { force: { automerge: true } }),
      ).toBeUndefined();

      expect(schemaError(globalSchema, { force: { automerge: 'nope' } })).toBe(
        'must be boolean',
      );
    });
  });

  describe('documented options', () => {
    it('links every option to a heading which exists', async () => {
      await expect(getLinksToMissingHeadings()).resolves.toBeEmptyArray();
    });
  });
});
