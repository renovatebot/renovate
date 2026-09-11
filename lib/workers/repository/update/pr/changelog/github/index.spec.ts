import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../../../config/global.ts';
import * as dockerVersioning from '../../../../../../modules/versioning/docker/index.ts';
import * as semverVersioning from '../../../../../../modules/versioning/semver/index.ts';
import * as packageCache from '../../../../../../util/cache/package/index.ts';
import * as githubGraphql from '../../../../../../util/github/graphql/index.ts';
import type { GithubTagItem } from '../../../../../../util/github/graphql/types.ts';
import * as hostRules from '../../../../../../util/host-rules.ts';
import type { Timestamp } from '../../../../../../util/timestamp.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { getChangeLogJSON } from '../index.ts';

vi.mock('../../../../../../modules/datasource/npm/index.ts');

const upgrade = partial<BranchUpgradeConfig>({
  manager: 'some-manager',
  branchName: '',
  packageName: 'renovate',
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
      releaseTimestamp: '2017-10-24T03:20:46.238Z' as Timestamp,
    },
    { version: '2.2.2', gitRef: 'npm_2.2.2' },
    {
      version: '2.4.2',
      releaseTimestamp: '2017-12-24T03:20:46.238Z' as Timestamp,
    },
    { version: '2.5.2' },
  ],
});

function expectedChangeLog({
  baseUrl = 'https://github.com/',
  apiBaseUrl = 'https://api.github.com/',
  sourceUrl = 'https://github.com/chalk/chalk',
  packageName = 'renovate',
} = {}) {
  return {
    hasReleaseNotes: true,
    project: {
      apiBaseUrl,
      baseUrl,
      packageName,
      repository: 'chalk/chalk',
      sourceUrl,
      type: 'github',
    },
    versions: [
      { version: '2.5.2' },
      { version: '2.4.2' },
      { version: '2.3.0' },
      { version: '2.2.2' },
    ],
  };
}

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
      await expect(
        getChangeLogJSON({
          ...upgrade,
          currentVersion: undefined,
        }),
      ).resolves.toBeNull();
    });

    it('returns null if no currentVersion', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if currentVersion equals newVersion', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        }),
      ).resolves.toBeNull();
    });

    it('skips invalid repos', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/about',
        }),
      ).resolves.toBeNull();
    });

    it('works without Github', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
        }),
      ).resolves.toMatchObject(expectedChangeLog());
    });

    it('uses GitHub tags', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
        }),
      ).resolves.toMatchObject(expectedChangeLog());
    });

    it('fetches releases newest to oldest', async () => {
      const packageCacheSetSpy = vi.spyOn(packageCache, 'set');

      await getChangeLogJSON({
        ...upgrade,
      });

      const fetchedPairs = packageCacheSetSpy.mock.calls
        .filter((call) => call[0] === 'changelog-github-release')
        .map((call) => {
          const [, , prev, next] = call[1].split(':');
          return `${prev}->${next}`;
        });
      expect(fetchedPairs).toEqual([
        '2.4.2->2.5.2',
        '2.3.0->2.4.2',
        '2.2.2->2.3.0',
        '1.0.0->2.2.2',
      ]);
    });

    it('filters unnecessary warns', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          packageName: '@renovate/no',
        }),
      ).resolves.toMatchObject(
        expectedChangeLog({ packageName: '@renovate/no' }),
      );
    });

    it('supports node engines', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          depType: 'engines',
        }),
      ).resolves.toMatchObject(expectedChangeLog());
    });

    it('handles no sourceUrl', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: undefined,
        }),
      ).resolves.toBeNull();
    });

    it('handles invalid sourceUrl', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'http://example.com',
        }),
      ).resolves.toBeNull();
    });

    it('handles missing Github token', async () => {
      GlobalConfig.set({ githubTokenWarn: true });
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com',
        }),
      ).resolves.toEqual({ error: 'MissingGithubToken' });
    });

    it('handles suppressed Github warnings', async () => {
      GlobalConfig.set({ githubTokenWarn: false });
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com',
        }),
      ).resolves.toBeNull();
    });

    it('handles no releases', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          releases: [],
        }),
      ).resolves.toBeNull();
    });

    it('handles not enough releases', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        }),
      ).resolves.toBeNull();
    });

    it('deduplicates releases which are equal for the versioning in use', async () => {
      await expect(
        getChangeLogJSON({
          ...upgrade,
          versioning: dockerVersioning.id,
          currentVersion: 'v2.2.2',
          newVersion: 'v2.5.2',
          releases: [
            { version: '2.2.2' },
            { version: '2.3.0' },
            { version: 'v2.3.0' },
            { version: '2.5.2' },
            { version: 'v2.5.2' },
          ],
        }),
      ).resolves.toMatchObject({
        versions: [{ version: 'v2.5.2' }, { version: 'v2.3.0' }],
      });
    });

    it('supports github enterprise and github.com changelog', async () => {
      hostRules.add({
        hostType: 'github',
        token: 'super_secret',
        matchHost: 'https://github-enterprise.example.com/',
      });
      await expect(
        getChangeLogJSON({
          ...upgrade,
        }),
      ).resolves.toMatchObject(expectedChangeLog());
    });

    it('supports github enterprise and github enterprise changelog', async () => {
      hostRules.add({
        hostType: 'github',
        matchHost: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      vi.stubEnv('GITHUB_ENDPOINT', '');
      await expect(
        getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
        }),
      ).resolves.toMatchObject(
        expectedChangeLog({
          baseUrl: 'https://github-enterprise.example.com/',
          apiBaseUrl: 'https://github-enterprise.example.com/api/v3/',
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
        }),
      );
    });

    it('works with same version releases but different prefix', async () => {
      const githubTagsMock = vi.spyOn(githubGraphql, 'queryTags');
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
      await expect(
        getChangeLogJSON({
          ...upgradeData,
        }),
      ).resolves.toMatchObject({
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: undefined,
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
