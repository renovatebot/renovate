import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as hostRules from '../../../util/host-rules';
import * as rubyVersioning from '../../versioning/ruby';
import { PodDatasource } from '.';

const config = {
  versioning: rubyVersioning.id,
  datasource: PodDatasource.id,
  packageName: 'foo',
  registryUrls: [],
};

const githubApiHost = 'https://api.github.com';
const githubEntApiHost = 'https://github.foo.com';
const githubEntApiHost2 = 'https://ghe.foo.com';
const cocoapodsHost = 'https://cdn.cocoapods.org';

describe('modules/datasource/pod/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      hostRules.clear();
    });

    it('returns null for invalid inputs', async () => {
      // FIXME: why get request?
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_3_8_5.txt')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: PodDatasource.id,
          packageName: 'foobar',
          registryUrls: [],
        }),
      ).toBeNull();
    });

    it('returns null disabled host', async () => {
      hostRules.add({ matchHost: cocoapodsHost, enabled: false });
      expect(
        await getPkgReleases({
          datasource: PodDatasource.id,
          packageName: 'foobar',
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      // FIXME: why get request?
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(404);
      expect(await getPkgReleases(config)).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/repos/foo/bar/contents/a/c/b/foo')
        .reply(404)
        .get('/repos/foo/bar/contents/Specs/foo')
        .reply(404)
        .get('/repos/foo/bar/contents/foo')
        .reply(404);
      const res = await getPkgReleases({
        ...config,
        registryUrls: [...config.registryUrls, 'https://github.com/foo/bar'],
      });
      expect(res).toBeNull();
    });

    it('returns null for 404 Github enterprise', async () => {
      httpMock
        .scope(githubEntApiHost)
        .get('/api/v3/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/Specs/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/foo')
        .reply(404);
      const res = await getPkgReleases({
        ...config,
        registryUrls: [
          ...config.registryUrls,
          'https://github.foo.com/foo/bar',
        ],
      });
      expect(res).toBeNull();
    });

    it('returns null for 404 Github enterprise with different url style', async () => {
      httpMock
        .scope(githubEntApiHost2)
        .get('/api/v3/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/Specs/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/foo')
        .reply(404);
      const res = await getPkgReleases({
        ...config,
        registryUrls: [...config.registryUrls, 'https://ghe.foo.com/foo/bar'],
      });
      expect(res).toBeNull();
    });

    it('returns null for 401', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(401);
      expect(await getPkgReleases(config)).toBeNull();
    });

    it('throws for 429', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(429);
      await expect(getPkgReleases(config)).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 500', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(500);
      await expect(getPkgReleases(config)).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .replyWithError('foobar');
      expect(await getPkgReleases(config)).toBeNull();
    });

    it('processes real data from CDN', async () => {
      httpMock
        .scope(cocoapodsHost)
        .get('/all_pods_versions_a_c_b.txt')
        .reply(200, 'foo/1.2.3');
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: ['https://github.com/CocoaPods/Specs'],
        }),
      ).toEqual({
        registryUrl: 'https://github.com/CocoaPods/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github with shard with specs', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/Artsy/Specs/contents/Specs/a/c/b/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.com/Artsy/Specs'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.com/Artsy/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github with shard without specs', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/Artsy/Specs/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/a/c/b/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.com/Artsy/Specs'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.com/Artsy/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github with specs without shard', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/Artsy/Specs/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/a/c/b/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/Specs/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.com/Artsy/Specs'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.com/Artsy/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github without specs without shard', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/Artsy/Specs/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/a/c/b/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/Specs/foo')
        .reply(404)
        .get('/repos/Artsy/Specs/contents/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.com/Artsy/Specs'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.com/Artsy/Specs',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github Enterprise with shard with specs', async () => {
      httpMock
        .scope(githubEntApiHost)
        .get('/api/v3/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.foo.com/foo/bar'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.foo.com/foo/bar',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github Enterprise with shard without specs', async () => {
      httpMock
        .scope(githubEntApiHost)
        .get('/api/v3/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/a/c/b/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.foo.com/foo/bar'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.foo.com/foo/bar',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github Enterprise with specs without shard', async () => {
      httpMock
        .scope(githubEntApiHost)
        .get('/api/v3/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/Specs/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.foo.com/foo/bar'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.foo.com/foo/bar',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });

    it('processes real data from Github Enterprise without specs without shard', async () => {
      httpMock
        .scope(githubEntApiHost)
        .get('/api/v3/repos/foo/bar/contents/Specs/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/a/c/b/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/Specs/foo')
        .reply(404)
        .get('/api/v3/repos/foo/bar/contents/foo')
        .reply(200, [{ name: '1.2.3' }]);
      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://github.foo.com/foo/bar'],
      });
      expect(res).toEqual({
        registryUrl: 'https://github.foo.com/foo/bar',
        releases: [
          {
            version: '1.2.3',
          },
        ],
      });
    });
  });
});
