import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import * as _hostRules from '../../../util/host-rules';
import { CacheableGithubReleases } from '../github-releases/cache';
import { CacheableGithubTags } from './cache';
import { GithubTagsDatasource } from '.';

jest.mock('../../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';
const githubEnterpriseApiHost = 'https://git.enterprise.com';

describe('modules/datasource/github-tags/index', () => {
  const releasesCacheGetItems = jest.spyOn(
    CacheableGithubReleases.prototype,
    'getItems'
  );
  const tagsCacheGetItems = jest.spyOn(
    CacheableGithubTags.prototype,
    'getItems'
  );

  const github = new GithubTagsDatasource();

  beforeEach(() => {
    jest.resetAllMocks();
    hostRules.hosts = jest.fn(() => []);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
  });

  describe('getDigest', () => {
    const packageName = 'some/dep';

    it('returns commit digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);

      const res = await github.getDigest({ packageName }, null);

      expect(res).toBe('abcdef');
    });

    it('returns null for missing commit', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, []);

      const res = await github.getDigest({ packageName }, null);

      expect(res).toBeNull();
    });

    it('returns tag digest', async () => {
      tagsCacheGetItems.mockResolvedValueOnce([
        { version: 'v1.0.0', releaseTimestamp: '2021-01-01', hash: 'aaa' },
        { version: 'v2.0.0', releaseTimestamp: '2022-01-01', hash: 'bbb' },
      ]);

      const res = await github.getDigest({ packageName }, 'v2.0.0');

      expect(res).toBe('bbb');
    });

    it('returns null for missing tag', async () => {
      tagsCacheGetItems.mockResolvedValueOnce([
        { version: 'v1.0.0', releaseTimestamp: '2021-01-01', hash: 'aaa' },
        { version: 'v2.0.0', releaseTimestamp: '2022-01-01', hash: 'bbb' },
      ]);

      const res = await github.getDigest({ packageName }, 'v3.0.0');

      expect(res).toBeNull();
    });

    it('supports GHE', async () => {
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);

      const res = await github.getDigest(
        { packageName, registryUrl: githubEnterpriseApiHost },
        null
      );

      expect(res).toBe('abcdef');
    });
  });

  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      hostRules.find.mockReturnValue({
        token: 'some-token',
      });
    });

    const depName = 'some/dep2';

    it('returns tags', async () => {
      tagsCacheGetItems.mockResolvedValueOnce([
        { version: 'v1.0.0', releaseTimestamp: '2021-01-01', hash: '123' },
        { version: 'v2.0.0', releaseTimestamp: '2022-01-01', hash: 'abc' },
      ]);
      releasesCacheGetItems.mockResolvedValueOnce([
        { version: 'v1.0.0', releaseTimestamp: '2021-01-01', isStable: true },
        { version: 'v2.0.0', releaseTimestamp: '2022-01-01', isStable: false },
      ] as never);

      const res = await getPkgReleases({ datasource: github.id, depName });

      expect(res).toEqual({
        registryUrl: 'https://github.com',
        sourceUrl: 'https://github.com/some/dep2',
        releases: [
          {
            gitRef: 'v1.0.0',
            hash: '123',
            isStable: true,
            releaseTimestamp: '2021-01-01T00:00:00.000Z',
            version: 'v1.0.0',
          },

          {
            gitRef: 'v2.0.0',
            hash: 'abc',
            isStable: false,
            releaseTimestamp: '2022-01-01T00:00:00.000Z',
            version: 'v2.0.0',
          },
        ],
      });
    });
  });
});
