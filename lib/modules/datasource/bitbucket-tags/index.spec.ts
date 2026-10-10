import type { MockInstance } from 'vitest';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { BitbucketTagsDatasource } from './index.ts';

const datasource = BitbucketTagsDatasource.id;

describe('modules/datasource/bitbucket-tags/index', () => {
  describe('getReleases', () => {
    it('returns tags from bitbucket cloud', async () => {
      const body = {
        pagelen: 3,
        values: [
          {
            name: 'v1.0.0',
            target: {
              date: '2020-11-19T09:05:35+00:00',
            },
          },
          {
            name: 'v1.1.0',
            target: {},
          },
          {
            name: 'v1.1.1',
          },
        ],
        page: 1,
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags?pagelen=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toEqual({
        registryUrl: 'https://bitbucket.org',
        releases: [
          {
            gitRef: 'v1.0.0',
            releaseTimestamp: '2020-11-19T09:05:35.000Z',
            version: 'v1.0.0',
          },
          {
            gitRef: 'v1.1.0',
            version: 'v1.1.0',
          },
          {
            gitRef: 'v1.1.1',
            version: 'v1.1.1',
          },
        ],
        sourceUrl: 'https://bitbucket.org/some/dep2',
      });
    });
  });

  describe('getDigest', () => {
    it('returns commits from bitbucket cloud', async () => {
      const body = {
        pagelen: 3,
        values: [
          {
            hash: '123',
            date: '2020-11-19T09:05:35+00:00',
          },
          {
            hash: '133',
            date: '2020-11-19T09:05:36+00:00',
          },
          {
            hash: '333',
            date: '2020-11-19T09:05:37+00:00',
          },
        ],
        page: 1,
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2')
        .reply(200, {
          mainbranch: { name: 'master' },
          uuid: '123',
          full_name: 'some/repo',
        });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toBeString();
      expect(res).toBe('123');
    });
  });

  describe('getDigest with no commits', () => {
    it('returns commits from bitbucket cloud', async () => {
      const body = {
        pagelen: 0,
        values: [],
        page: 1,
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2')
        .reply(200, {
          mainbranch: { name: 'master' },
          uuid: '123',
          full_name: 'some/repo',
        });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toBeNull();
    });
  });

  describe('getTagCommit', () => {
    it('returns tags commit hash from bitbucket cloud', async () => {
      const body = {
        name: 'v1.0.0',
        target: {
          date: '2020-11-19T09:05:35+00:00',
          hash: '123',
        },
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags/v1.0.0')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          packageName: 'some/dep2',
        },
        'v1.0.0',
      );
      expect(res).toBeString();
      expect(res).toBe('123');
    });

    it('caches the digest of a tag separately from the latest commit', async () => {
      const cache = new Map<string, unknown>();
      vi.spyOn(packageCache, 'get').mockImplementation((ns, key) =>
        Promise.resolve(cache.get(`${ns}|${key}`)),
      );
      vi.spyOn(packageCache, 'setWithRawTtl').mockImplementation(
        (ns, key, value) => {
          cache.set(`${ns}|${key}`, value);
          return Promise.resolve();
        },
      );
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2')
        .reply(200, {
          mainbranch: { name: 'master' },
          uuid: '123',
          full_name: 'some/repo',
        })
        .get('/2.0/repositories/some/dep2/commits/master')
        .reply(200, {
          pagelen: 1,
          values: [{ hash: 'latest-sha', date: '2020-11-19T09:05:35+00:00' }],
          page: 1,
        })
        .get('/2.0/repositories/some/dep2/refs/tags/v1.0.0')
        .reply(200, { name: 'v1.0.0', target: { hash: 'tag-sha' } });
      const config = { datasource, packageName: 'some/dep2' };

      await expect(getDigest(config)).resolves.toBe('latest-sha');
      await expect(getDigest(config, 'v1.0.0')).resolves.toBe('tag-sha');
    });

    it('returns null for missing hash', async () => {
      const body = {
        name: 'v1.0.0',
      };
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags/v1.0.0')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          packageName: 'some/dep2',
        },
        'v1.0.0',
      );
      expect(res).toBeNull();
    });
  });

  describe('package cache', () => {
    let setCache: MockInstance<typeof packageCache.setWithRawTtl>;

    beforeEach(() => {
      setCache = vi.spyOn(packageCache, 'setWithRawTtl');
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some/dep2/refs/tags?pagelen=100')
        .reply(200, { pagelen: 1, values: [{ name: 'v1.0.0' }], page: 1 });
    });

    afterEach(() => {
      setCache.mockRestore();
      GlobalConfig.reset();
    });

    it('does not cache the tags of a repository which may be private', async () => {
      await new BitbucketTagsDatasource().getReleases({
        packageName: 'some/dep2',
      });

      expect(setCache).not.toHaveBeenCalled();
    });

    it('caches the tags if cachePrivatePackages is enabled', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });

      await new BitbucketTagsDatasource().getReleases({
        packageName: 'some/dep2',
      });

      expect(setCache).toHaveBeenCalledOnce();
    });
  });
});
