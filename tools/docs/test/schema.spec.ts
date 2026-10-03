import { getOptions } from '../../../lib/config/options/index.ts';
import type {
  RenovateOptions,
  RenovateStringOption,
} from '../../../lib/config/types.ts';
import { allManagersList } from '../../../lib/modules/manager/index.ts';
import { partial } from '../../../test/util.ts';
import { readFile } from '../../utils/index.ts';
import { getOptionDocsUrl } from '../schema.ts';

const managers = new Set<string>(allManagersList);

function option(overrides: Partial<RenovateStringOption>): RenovateOptions {
  return partial<RenovateStringOption>({
    name: 'anOption',
    description: 'A description',
    type: 'string',
    ...overrides,
  });
}

/**
 * The anchors of the headings which document config options on the given page, e.g. `enabled` or `packagerulesmatchpackagenames`.
 */
async function readDocsAnchors(configFile: string): Promise<Set<string>> {
  const content = await readFile(`docs/usage/${configFile}`);
  const headings = content
    .split('\n')
    .filter((line) => line.startsWith('## ') || line.startsWith('### '))
    .map((line) => line.split(' ')[1].replace(/^`|`$/g, ''));

  return new Set(
    headings.map((heading) => heading.replaceAll('.', '').toLowerCase()),
  );
}

async function getLinksToMissingHeadings(): Promise<string[]> {
  const anchors = {
    'configuration-options': await readDocsAnchors('configuration-options.md'),
    'self-hosted-configuration': await readDocsAnchors(
      'self-hosted-configuration.md',
    ),
  };

  return (
    getOptions()
      /* managers are documented in their own module pages, not in the config pages */
      .filter((o) => !managers.has(o.name))
      .map((o) => [o.name, getOptionDocsUrl(o)] as const)
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
      expect(getOptionDocsUrl(option({ name: 'automerge' }))).toBe(
        'https://docs.renovatebot.com/configuration-options/#automerge',
      );
    });

    it('links a child option to the heading under its parent', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'commands', parents: ['postUpgradeTasks'] }),
        ),
      ).toBe(
        'https://docs.renovatebot.com/configuration-options/#postupgradetaskscommands',
      );
    });

    it('links a global option to the self-hosted page', () => {
      expect(
        getOptionDocsUrl(option({ name: 'onboarding', globalOnly: true })),
      ).toBe(
        'https://docs.renovatebot.com/self-hosted-configuration/#onboarding',
      );
    });

    it('links an option which is valid in several places to the first of its parents', () => {
      expect(
        getOptionDocsUrl(
          option({ name: 'enabled', parents: ['.', 'packageRules', 'npm'] }),
        ),
      ).toBe(
        'https://docs.renovatebot.com/configuration-options/#packagerulesenabled',
      );
    });
  });

  describe('documented options', () => {
    it('links some options to a heading which does not exist', async () => {
      await expect(getLinksToMissingHeadings()).resolves.toEqual([
        'enabled -> https://docs.renovatebot.com/configuration-options/#packagerulesenabled',
        'fetchChangeLogs -> https://docs.renovatebot.com/configuration-options/#packagerulesfetchchangelogs',
        'managerFilePatterns -> https://docs.renovatebot.com/configuration-options/#ansiblemanagerfilepatterns',
      ]);
    });
  });
});
