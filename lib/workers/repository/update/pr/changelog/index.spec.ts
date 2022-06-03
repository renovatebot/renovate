import * as httpMock from '../../../../../../test/http-mock';
import { partial } from '../../../../../../test/util';
import { GlobalConfig } from '../../../../../config/global';
import { PlatformId } from '../../../../../constants';
import { CacheableGithubReleases } from '../../../../../modules/datasource/github-releases/cache';
import { CacheableGithubTags } from '../../../../../modules/datasource/github-tags/cache';
import * as semverVersioning from '../../../../../modules/versioning/semver';
import * as hostRules from '../../../../../util/host-rules';
import type { BranchConfig } from '../../../../types';
import { ChangeLogError, getChangeLogJSON } from '.';

jest.mock('../../../../../modules/datasource/npm');

const githubApiHost = 'https://api.github.com';

const upgrade: BranchConfig = partial<BranchConfig>({
  endpoint: 'https://api.github.com/',
  depName: 'renovate',
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

describe('workers/repository/update/pr/changelog/index', () => {
  describe('getChangeLogJSON', () => {
    const githubReleasesMock = jest.spyOn(
      CacheableGithubReleases.prototype,
      'getItems'
    );
    const githubTagsMock = jest.spyOn(
      CacheableGithubTags.prototype,
      'getItems'
    );

    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.clear();
      hostRules.add({
        hostType: PlatformId.Github,
        matchHost: 'https://api.github.com/',
        token: 'abc',
      });
    });

    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: null,
        })
      ).toBeNull();
    });

    it('returns null if no currentVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
        })
      ).toBeNull();
    });

    it('returns null if currentVersion equals newVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          currentVersion: '1.0.0',
          newVersion: '1.0.0',
        })
      ).toBeNull();
    });

    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com/about',
        })
      ).toBeNull();
    });

    it('works without Github', async () => {
      githubTagsMock.mockRejectedValueOnce(new Error('Unknown'));
      githubReleasesMock.mockRejectedValueOnce(new Error('Unknown'));
      httpMock
        .scope(githubApiHost)
        .get('/repos/chalk/chalk')
        .times(4)
        .reply(500);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
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
      httpMock.scope(githubApiHost).get(/.*/).reply(200, []).persist();
      githubTagsMock.mockResolvedValue([
        { version: '0.9.0' },
        { version: '1.0.0' },
        { version: '1.4.0' },
        { version: 'v2.3.0' },
        { version: '2.2.2' },
        { version: 'v2.4.2' },
      ] as never);
      githubReleasesMock.mockResolvedValue([]);
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
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
      githubTagsMock.mockRejectedValueOnce(new Error('Unknown Github Repo'));
      githubReleasesMock.mockRejectedValueOnce(
        new Error('Unknown Github Repo')
      );
      httpMock.scope(githubApiHost).get(/.*/).reply(200, []).persist();
      const res = await getChangeLogJSON({
        ...upgrade,
        depName: '@renovate/no',
      });
      expect(res).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: '@renovate/no',
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
      githubTagsMock.mockRejectedValueOnce([]);
      githubReleasesMock.mockRejectedValueOnce([]);
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depType: 'engines',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
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
      // FIXME: missing mocks
      httpMock.clear(false);
    });

    it('handles no sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: undefined,
        })
      ).toBeNull();
    });

    it('handles invalid sourceUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'http://example.com',
        })
      ).toBeNull();
    });

    it('handles missing Github token', async () => {
      GlobalConfig.set({ githubTokenWarn: true });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github.com',
        })
      ).toEqual({ error: ChangeLogError.MissingGithubToken });
    });

    it('handles no releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [],
        })
      ).toBeNull();
    });

    it('handles not enough releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        })
      ).toBeNull();
    });

    it('supports github enterprise and github.com changelog', async () => {
      githubTagsMock.mockRejectedValueOnce([]);
      githubReleasesMock.mockRejectedValueOnce([]);
      httpMock.scope(githubApiHost).persist().get(/.*/).reply(200, []);
      hostRules.add({
        hostType: PlatformId.Github,
        token: 'super_secret',
        matchHost: 'https://github-enterprise.example.com/',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          endpoint: 'https://github-enterprise.example.com/',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
          depName: 'renovate',
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

    it('supports github enterprise and github enterprise changelog', async () => {
      githubTagsMock.mockRejectedValueOnce([]);
      githubReleasesMock.mockRejectedValueOnce([]);
      httpMock
        .scope('https://github-enterprise.example.com')
        .persist()
        .get(/.*/)
        .reply(200, []);
      hostRules.add({
        hostType: PlatformId.Github,
        matchHost: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
          endpoint: 'https://github-enterprise.example.com/',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://github-enterprise.example.com/api/v3/',
          baseUrl: 'https://github-enterprise.example.com/',
          depName: 'renovate',
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

    it('supports github.com and github enterprise changelog', async () => {
      githubTagsMock.mockRejectedValueOnce([]);
      githubReleasesMock.mockRejectedValueOnce([]);
      httpMock
        .scope('https://github-enterprise.example.com')
        .persist()
        .get(/.*/)
        .reply(200, []);
      hostRules.add({
        hostType: PlatformId.Github,
        matchHost: 'https://github-enterprise.example.com/',
        token: 'abc',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          sourceUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot({
        hasReleaseNotes: true,
        project: {
          apiBaseUrl: 'https://github-enterprise.example.com/api/v3/',
          baseUrl: 'https://github-enterprise.example.com/',
          depName: 'renovate',
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
  });
});
