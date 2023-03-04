import * as httpMock from '../../../../../../test/http-mock';
import { partial } from '../../../../../../test/util';
import { GlobalConfig } from '../../../../../config/global';
import * as semverVersioning from '../../../../../modules/versioning/semver';
import * as githubGraphql from '../../../../../util/github/graphql';
import * as hostRules from '../../../../../util/host-rules';
import type { BranchConfig } from '../../../../types';
import { getChangeLogJSON } from '.';

jest.mock('../../../../../modules/datasource/npm');

const githubApiHost = 'https://api.github.com';

const githubTagsMock = jest.spyOn(githubGraphql, 'queryTags');
const githubReleasesMock = jest.spyOn(githubGraphql, 'queryReleases');

const upgrade = partial<BranchConfig>({
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
      // 4 versions, so 4 calls without cache
      githubReleasesMock
        .mockRejectedValueOnce(new Error('Unknown'))
        .mockRejectedValueOnce(new Error('Unknown'))
        .mockRejectedValueOnce(new Error('Unknown'))
        .mockRejectedValueOnce(new Error('Unknown'));
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
      githubTagsMock.mockResolvedValueOnce([]);
      githubReleasesMock.mockResolvedValueOnce([]);
      httpMock.scope(githubApiHost).get(/.*/).reply(200, []).persist();
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
      ).toEqual({ error: 'MissingGithubToken' });
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
        hostType: 'github',
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
        hostType: 'github',
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
