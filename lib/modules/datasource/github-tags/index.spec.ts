import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import * as _hostRules from '../../../util/host-rules';
import { GithubTagsDatasource } from '.';

jest.mock('../../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';
const githubEnterpriseApiHost = 'https://git.enterprise.com';

const releasesCacheGetItems = jest.fn();
jest.mock('../github-releases/cache', () => {
  return {
    CacheableGithubReleases: jest.fn().mockImplementation(() => {
      return { getItems: () => releasesCacheGetItems() };
    }),
  };
});

const tagsCacheGetItems = jest.fn();
jest.mock('./cache', () => {
  return {
    CacheableGithubTags: jest.fn().mockImplementation(() => {
      return { getItems: () => tagsCacheGetItems() };
    }),
  };
});

describe('modules/datasource/github-tags/index', () => {
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
    const tag = 'v1.2.0';

    it('returns null if no token', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, []);
      const res = await github.getDigest({ packageName }, null);
      expect(res).toBeNull();
    });

    it('returns digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);
      const res = await github.getDigest({ packageName }, null);
      expect(res).toBe('abcdef');
    });

    it('returns commit digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/git/refs/tags/${tag}`)
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } });
      const res = await github.getDigest({ packageName }, tag);
      expect(res).toBe('ddd111');
    });

    it('returns tagged commit digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/git/refs/tags/${tag}`)
        .reply(200, {
          object: { type: 'tag', url: `${githubApiHost}/some-url` },
        })
        .get('/some-url')
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } });
      const res = await github.getDigest({ packageName }, tag);
      expect(res).toBe('ddd111');
    });

    it('warns if unknown ref', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/git/refs/tags/${tag}`)
        .reply(200, { object: { sha: 'ddd111' } });
      const res = await github.getDigest({ packageName }, tag);
      expect(res).toBeNull();
    });

    it('returns null for missed tagged digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/git/refs/tags/${tag}`)
        .reply(200, {});
      const res = await github.getDigest({ packageName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });

    it('supports ghe', async () => {
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${packageName}/git/refs/tags/${tag}`)
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } })
        .get(`/api/v3/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);

      const sha1 = await github.getDigest(
        { packageName, registryUrl: githubEnterpriseApiHost },
        null
      );
      const sha2 = await github.getDigest(
        { packageName: 'some/dep', registryUrl: githubEnterpriseApiHost },
        'v1.2.0'
      );

      expect(sha1).toBe('abcdef');
      expect(sha2).toBe('ddd111');
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
      ]);

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
