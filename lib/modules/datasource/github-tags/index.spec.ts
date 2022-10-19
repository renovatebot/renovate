import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import * as githubGraphql from '../../../util/github/graphql';
import * as hostRules from '../../../util/host-rules';
import { GithubTagsDatasource } from '.';

const githubApiHost = 'https://api.github.com';
const githubEnterpriseApiHost = 'https://git.enterprise.com';

describe('modules/datasource/github-tags/index', () => {
  const github = new GithubTagsDatasource();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(hostRules, 'hosts').mockReturnValue([]);
    jest.spyOn(hostRules, 'find').mockReturnValue({
      token: 'some-token',
    });
  });

  describe('getDigest', () => {
    const packageName = 'some/dep';
    const tag = 'v1.2.0';

    it('returns commit digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);

      const res = await github.getDigest({ packageName }, undefined);

      expect(res).toBe('abcdef');
    });

    it('returns null for missing commit', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, []);
      const res = await github.getDigest({ packageName }, undefined);
      expect(res).toBeNull();
    });

    it('returns digest', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);
      const res = await github.getDigest({ packageName }, undefined);
      expect(res).toBe('abcdef');
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

    it('supports GHE', async () => {
      httpMock
        .scope(githubEnterpriseApiHost)
        .get(`/api/v3/repos/${packageName}/git/refs/tags/${tag}`)
        .reply(200, { object: { type: 'commit', sha: 'ddd111' } })
        .get(`/api/v3/repos/${packageName}/commits?per_page=1`)
        .reply(200, [{ sha: 'abcdef' }]);

      const sha1 = await github.getDigest(
        { packageName, registryUrl: githubEnterpriseApiHost },
        undefined
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
    const depName = 'some/dep2';

    it('returns tags', async () => {
      jest.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          gitRef: 'v1.0.0',
          releaseTimestamp: '2021-01-01',
          newDigest: '123',
        },
        {
          version: 'v2.0.0',
          gitRef: 'v2.0.0',
          releaseTimestamp: '2022-01-01',
          newDigest: 'abc',
        },
      ]);

      const res = await getPkgReleases({ datasource: github.id, depName });

      expect(res).toEqual({
        registryUrl: 'https://github.com',
        releases: [
          {
            gitRef: 'v1.0.0',
            version: 'v1.0.0',
            releaseTimestamp: '2021-01-01T00:00:00.000Z',
          },
          {
            gitRef: 'v2.0.0',
            version: 'v2.0.0',
            releaseTimestamp: '2022-01-01T00:00:00.000Z',
          },
        ],

        sourceUrl: 'https://github.com/some/dep2',
      });
    });
  });
});
