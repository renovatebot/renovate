import { getChangeLogJSON } from '..';
import * as httpMock from '../../../../../../../test/http-mock';
import { partial } from '../../../../../../../test/util';
import { GlobalConfig } from '../../../../../../config/global';
import * as semverVersioning from '../../../../../../modules/versioning/semver';
import * as githubGraphql from '../../../../../../util/github/graphql';
import type { GithubTagItem } from '../../../../../../util/github/graphql/types';
import * as hostRules from '../../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../../types';

jest.mock('../../../../../../modules/datasource/npm');

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  packageName: 'renovate',
  endpoint: 'https://api.github.com/',
  versioning: semverVersioning.id,
  currentVersion: '1.0.0',
  newVersion: '3.0.0',
  sourceUrl: 'https://github.com/chalk/chalk',
  releases: [
    { version: '0.9.0' },
    { version: '1.0.0', gitRef: 'npm_1.0.0' },
    {
      version: '2.3.0',
      gitRef: 'npm_2.3.0',
      releaseTimestamp: '2017-10-24T03:20:46.238Z',
    },
    { version: '2.2.2', gitRef: 'npm_2.2.2' },
    { version: '2.4.2', releaseTimestamp: '2017-12-24T03:20:46.238Z' },
    { version: '2.5.2' },
  ],
});

describe('workers/repository/update/pr/changelog/github/index', () => {
  afterEach(() => {
    // FIXME: add missing http mocks
    httpMock.clear(false);
  });

  describe('getChangeLogJSON', () => {
    beforeEach(() => {
      hostRules.clear();
      hostRules.add({
        hostType: 'github',
        matchHost: 'https://api.github.com/',
        token: 'abc',
      });
    });

    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: undefined,
        }),
      ).toBeNull();
    });

    it('returns null if no currentVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
        }),
      ).toBeNull();
    });

    it('returns null if currentVersion equals newVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        }),
      ).toBeNull();
    });

    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/about',
        }),
      ).toBeNull();
    });

    it('works without Github', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          packageName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('uses GitHub tags', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        }),
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          packageName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('filters unnecessary warns', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          packageName: '@renovate/no',
        }),
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          packageName: '@renovate/no',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('supports node engines', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depType: 'engines',
        }),
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          packageName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('handles no sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: undefined,
        }),
      ).toBeNull();
    });

    it('handles invalid sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'http://example.com',
        }),
      ).toBeNull();
    });

    it('handles missing Github token', async () => {
      GlobalConfig.set({ githubTokenWarn: true });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com',
        }),
      ).toEqual({ error: 'MissingGithubToken' });
    });

    it('handles suppressed Github warnings', async () => {
      GlobalConfig.set({ githubTokenWarn: false });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com',
        }),
      ).toBeNull();
    });

    it('handles no releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [],
        }),
      ).toBeNull();
    });

    it('handles not enough releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        }),
      ).toBeNull();
    });

    it('supports github enterprise and github.com changelog', async () => {
      hostRules.add({
        hostType: 'github',
        token: 'super_secret',
        matchHost: 'https://github-enterprise.example.com/',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          endpoint: 'https://github-enterprise.example.com/',
        }),
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          packageName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('supports overwriting sourceUrl for supports github enterprise and github.com changelog', async () => {
      const sourceUrl = upgrade.sourceUrl;
      const replacementSourceUrl = 'https://github.com/sindresorhus/got';
      const config = {
        ...upgrade,
        endpoint: 'https://github-enterprise.example.com/',
        customChangelogUrl: replacementSourceUrl,
      };
      hostRules.add({
        hostType: 'github',
        token: 'super_secret',
        matchHost: 'https://github-enterprise.example.com/',
      });
      expect(await getChangeLogJSON(config)).toMatchObject({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          packageName: 'renovate',
          repository: 'sindresorhus/got',
          sourceDirectory: undefined,
          sourceUrl: 'https://github.com/sindresorhus/got',
          type: 'github',
        },
      });
      expect(upgrade.sourceUrl).toBe(sourceUrl); // ensure unmodified function argument
    });

    it('supports github enterprise and github enterprise changelog', async () => {
      hostRules.add({
        hostType: 'github',
        matchHost: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
          endpoint: 'https://github-enterprise.example.com/',
        }),
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://github-enterprise.example.com/api/v3/',
          baseUrl: 'https://github-enterprise.example.com/',
          packageName: 'renovate',
          repository: 'chalk/chalk',
          sourceDirectory: undefined,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
          type: 'github',
        },
        versions: [
          { version: '2.5.2' },
          { version: '2.4.2' },
          { version: '2.3.0' },
          { version: '2.2.2' },
        ],
      });
    });

    it('supports overwriting sourceUrl for github enterprise and github enterprise changelog', async () => {
      const sourceUrl = 'https://github-enterprise.example.com/chalk/chalk';
      const replacementSourceUrl =
        'https://github-enterprise.example.com/sindresorhus/got';
      const config = {
        ...upgrade,
        sourceUrl,
        endpoint: 'https://github-enterprise.example.com/',
        customChangelogUrl: replacementSourceUrl,
      };
      hostRules.add({
        hostType: 'github',
        matchHost: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(await getChangeLogJSON(config)).toMatchObject({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://github-enterprise.example.com/api/v3/',
          baseUrl: 'https://github-enterprise.example.com/',
          packageName: 'renovate',
          repository: 'sindresorhus/got',
          sourceDirectory: undefined,
          sourceUrl: 'https://github-enterprise.example.com/sindresorhus/got',
          type: 'github',
        },
      });
      expect(config.sourceUrl).toBe(sourceUrl); // ensure unmodified function argument
    });

    it('works with same version releases but different prefix', async () => {
      const githubTagsMock = jest.spyOn(githubGraphql, 'queryTags');
      githubTagsMock.mockResolvedValue(
        partial<GithubTagItem>([
          { version: 'v1.0.1' },
          { version: '1.0.1' },
          { version: 'correctPrefix/target@1.0.1' },
          { version: 'wrongPrefix/target-1.0.1' },
          { version: 'v1.0.2' },
          { version: '1.0.2' },
          { version: 'correctPrefix/target-1.0.2' },
          { version: 'wrongPrefix/target@1.0.2' },
        ]),
      );

      const upgradeData = partial<BranchUpgradeConfig>({
        manager: 'some-manager',
        branchName: '',
        packageName: 'correctPrefix/target',
        endpoint: 'https://api.github.com/',
        versioning: 'npm',
        currentVersion: '1.0.0',
        newVersion: '1.0.2',
        sourceUrl: 'https://github.com/chalk/chalk',
        releases: [
          { version: '1.0.2', gitRef: '789012' },
          { version: '1.0.1', gitRef: '123456' },
          { version: '0.1.1', gitRef: 'npm_1.0.0' },
        ],
      });
      expect(
        await getChangeLogJSON({
          ...upgradeData,
        }),
      ).toMatchObject({
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          type: 'github',
          repository: 'chalk/chalk',
          sourceUrl: 'https://github.com/chalk/chalk',
          sourceDirectory: undefined,
          packageName: 'correctPrefix/target',
        },
        versions: [
          {
            version: '1.0.2',
            date: undefined,
            changes: [],
            compare: {
              url: 'https://github.com/chalk/chalk/compare/correctPrefix/target@1.0.1...correctPrefix/target-1.0.2',
            },
            releaseNotes: {
              url: 'https://github.com/chalk/chalk/compare/correctPrefix/target@1.0.1...correctPrefix/target-1.0.2',
              notesSourceUrl: '',
            },
          },
          {
            version: '1.0.1',
            date: undefined,
            changes: [],
            compare: {
              url: 'https://github.com/chalk/chalk/compare/npm_1.0.0...correctPrefix/target@1.0.1',
            },
            releaseNotes: {
              url: 'https://github.com/chalk/chalk/compare/npm_1.0.0...correctPrefix/target@1.0.1',
              notesSourceUrl: '',
            },
          },
        ],
        hasReleaseNotes: true,
      });
    });
  });
});
