import type { ValidateFunction } from 'ajv';
import { Ajv } from 'ajv';
import _addFormats from 'ajv-formats';
import { getOptions } from '../../../lib/config/options/index.ts';
import type { RenovateOptions } from '../../../lib/config/types.ts';
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

function option(overrides: Partial<RenovateOptions>): RenovateOptions {
  return partial<RenovateOptions>({
    name: 'anOption',
    description: 'A description',
    type: 'string',
    ...overrides,
  });
}

function headings(repo: string[], global: string[] = []): DocsHeadings {
  return { repo: new Set(repo), global: new Set(global) };
}

async function compileSchema(isGlobal = false): Promise<ValidateFunction> {
  const ajv = new Ajv({ schemaId: '$id', strict: false });
  addFormats(ajv);
  return ajv.compile(await buildSchema({ isGlobal }));
}

describe('tools/docs/test/schema', () => {
  describe('getOptionDocsUrl', () => {
    it('links to the top-level heading when one exists', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'enabled', parents: ['.', 'packageRules'] }),
          headings(['enabled', 'packageRules.enabled']),
        ),
      ).toBe('https://docs.renovatebot.com/configuration-options/#enabled');
    });

    it('links to the parent which documents the option', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'commands', parents: ['postUpgradeTasks'] }),
          headings(['postUpgradeTasks.commands']),
        ),
      ).toBe(
        'https://docs.renovatebot.com/configuration-options/#postupgradetaskscommands',
      );
    });

    it('skips parents which do not document the option', () => {
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

    it('links global options to the self-hosted page', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'onboarding', globalOnly: true }),
          headings(['onboarding'], ['onboarding']),
        ),
      ).toBe(
        'https://docs.renovatebot.com/self-hosted-configuration/#onboarding',
      );
    });
  });

  describe('object options', () => {
    let repoSchema: ValidateFunction;
    let globalSchema: ValidateFunction;

    beforeAll(async () => {
      repoSchema = await compileSchema();
      globalSchema = await compileSchema(true);
    });

    it('allows a map of values to use any key', () => {
      expect(globalSchema({ secrets: { enabled: 'a-secret' } })).toBeTrue();
      expect(
        repoSchema({ registryAliases: { labels: 'https://example.com' } }),
      ).toBeTrue();
    });

    it('validates the values of a map', () => {
      expect(globalSchema({ secrets: { MY_TOKEN: 123 } })).toBeFalse();
      expect(repoSchema({ registryAliases: { docker: 123 } })).toBeFalse();
    });

    it('allows an environment variable named after a config option', () => {
      expect(repoSchema({ env: { automerge: 'true' } })).toBeTrue();
      expect(repoSchema({ env: { GOPROXY: 123 } })).toBeFalse();
    });

    it('validates the values of a map against their allowed values', () => {
      expect(
        repoSchema({ statusCheckWhen: { artifactError: 'failed' } }),
      ).toBeTrue();
      expect(
        repoSchema({ statusCheckWhen: { artifactError: 'sometimes' } }),
      ).toBeFalse();
    });

    it('validates an option which nests a config as a config', () => {
      expect(globalSchema({ force: { automerge: true } })).toBeTrue();
      expect(globalSchema({ force: { automerge: 'nope' } })).toBeFalse();
    });
  });

  describe('documented options', () => {
    it('links every option to a heading which exists', async () => {
      const docsHeadings = await readAllDocsHeadings();
      const anchors = {
        repo: toAnchors(docsHeadings.repo),
        global: toAnchors(docsHeadings.global),
      };

      const broken = getOptions()
        /* managers are documented in their own module pages, not in the config pages */
        .filter((o) => !managers.has(o.name))
        .map((o) => getOptionDocsUrl(o, docsHeadings))
        .filter((url) => {
          const [page, anchor] = url
            .replace('https://docs.renovatebot.com/', '')
            .split('/#');
          return !anchors[
            page === 'self-hosted-configuration' ? 'global' : 'repo'
          ].has(anchor);
        });

      expect(broken).toBeEmptyArray();
    });
  });
});

function toAnchors(docsHeadings: Set<string>): Set<string> {
  return new Set(
    [...docsHeadings].map((heading) =>
      heading.replaceAll('.', '').toLowerCase(),
    ),
  );
}
