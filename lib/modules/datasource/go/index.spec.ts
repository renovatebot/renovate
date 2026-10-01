import type { Mock, MockInstance } from 'vitest';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import type { ReleaseResult } from '../index.ts';
import { getPkgReleases } from '../index.ts';
import { GoDatasource } from './index.ts';

const getDigestMocks: Record<string, Mock> = {
  'bitbucket-tags': vi.fn(),
  'forgejo-tags': vi.fn(),
  'git-tags': vi.fn(),
  'gitea-tags': vi.fn(),
  'github-tags': vi.fn(),
  'gitlab-tags': vi.fn(),
};
vi.mock('./tag-datasources.ts', () => {
  return {
    getGoTagDatasource: (datasource: string) =>
      datasource in getDigestMocks
        ? { api: { getDigest: getDigestMocks[datasource] } }
        : undefined,
  };
});

const getReleasesProxyMock = vi.fn();
vi.mock('./releases-goproxy.ts', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('./releases-goproxy.ts')>()),
    getGoproxyReleases: (...args: unknown[]) => getReleasesProxyMock(...args),
  };
});

const datasource = new GoDatasource();

describe('modules/datasource/go/index', () => {
  describe('getReleases', () => {
    it('fetches releases', async () => {
      const expected = { releases: [{ version: '0.0.1' }] };
      getReleasesProxyMock.mockResolvedValue(expected);

      const res = await datasource.getReleases({
        packageName: 'golang.org/foo/bar',
      });

      expect(res).toBe(expected);
      expect(getReleasesProxyMock).toHaveBeenCalledExactlyOnceWith({
        packageName: 'golang.org/foo/bar',
      });
    });
  });

  describe('getDigest', () => {
    it('returns null for no go-source tag', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, '');
      const res = await datasource.getDigest(
        { packageName: 'golang.org/y/text' },
        undefined,
      );
      expect(res).toBeNull();
    });

    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, Fixtures.get('go-get-github.html'));
      const res = await datasource.getDigest(
        { packageName: 'golang.org/y/text' },
        undefined,
      );
      expect(res).toBeNull();
    });

    it('supports gitlab digest', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, Fixtures.get('go-get-gitlab.html'));
      getDigestMocks['gitlab-tags'].mockResolvedValue(
        'abcdefabcdefabcdefabcdef',
      );
      const res = await datasource.getDigest(
        { packageName: 'gitlab.com/group/subgroup' },
        undefined,
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });

    it('supports git digest', async () => {
      httpMock
        .scope('https://renovatebot.com/')
        .get('/abc/def?go-get=1')
        .reply(200, Fixtures.get('go-get-git-digest.html'));
      getDigestMocks['git-tags'].mockResolvedValue('abcdefabcdefabcdefabcdef');
      const res = await datasource.getDigest(
        { packageName: 'renovatebot.com/abc/def' },
        undefined,
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });

    it('supports gitlab digest with a specific branch', async () => {
      const branch = 'some-branch';
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, Fixtures.get('go-get-gitlab.html'));
      getDigestMocks['gitlab-tags'].mockResolvedValue(
        'abcdefabcdefabcdefabcdef',
      );
      const res = await datasource.getDigest(
        { packageName: 'gitlab.com/group/subgroup' },
        branch,
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
    });

    it('returns github digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, Fixtures.get('go-get-github.html'));
      getDigestMocks['github-tags'].mockResolvedValueOnce(
        'abcdefabcdefabcdefabcdef',
      );
      const res = await datasource.getDigest(
        { packageName: 'golang.org/x/text' },
        'v1.2.3',
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(getDigestMocks['github-tags']).toHaveBeenCalledExactlyOnceWith(
        {
          datasource: 'github-tags',
          packageName: 'golang/text',
          registryUrl: 'https://github.com',
        },
        'v1.2.3',
      );
    });

    it('returns github default branch digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, Fixtures.get('go-get-github.html'));
      getDigestMocks['github-tags'].mockResolvedValueOnce(
        'abcdefabcdefabcdefabcdef',
      );
      const res = await datasource.getDigest(
        { packageName: 'golang.org/x/text' },
        'v0.0.0',
      );
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(getDigestMocks['github-tags']).toHaveBeenCalledExactlyOnceWith(
        {
          datasource: 'github-tags',
          packageName: 'golang/text',
          registryUrl: 'https://github.com',
        },
        undefined,
      );
    });

    it('support bitbucket digest', async () => {
      getDigestMocks['bitbucket-tags'].mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          packageName: 'bitbucket.org/golang/text',
        },
        undefined,
      );
      expect(res).toBe('123');
    });

    it('support forgejo digest', async () => {
      getDigestMocks['forgejo-tags'].mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          packageName: 'code.forgejo.org/go-chi/cache',
        },
        undefined,
      );
      expect(res).toBe('123');
    });

    it('support gitea digest', async () => {
      getDigestMocks['gitea-tags'].mockResolvedValueOnce('123');
      const res = await datasource.getDigest(
        {
          packageName: 'gitea.com/go-chi/cache',
        },
        undefined,
      );
      expect(res).toBe('123');
    });

    describe('GOPROXY', () => {
      it('returns null when GOPROXY contains off', async () => {
        vi.stubEnv('GOPROXY', 'https://proxy.golang.org,off');
        const res = await datasource.getDigest(
          { packageName: 'golang.org/x/text' },
          'v1.2.3',
        );
        expect(res).toBeNull();
      });
    });
  });

  describe('using getPkgReleases', () => {
    describe('constraints', () => {
      // TODO deprecated #42600
      it('are respected based on an exact match on the `go` constraint', async () => {
        const expected: ReleaseResult = {
          releases: [
            // Go 1.24
            {
              version: 'v0.32.0',
              constraints: {
                go: ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              constraints: {
                go: ['1.24.2'],
              },
            },
            // Go 1.25
            {
              version: 'v0.34.0',
              constraints: {
                go: ['1.25.0'],
              },
            },
          ],
        };

        getReleasesProxyMock.mockResolvedValue(expected);

        const res = await getPkgReleases({
          datasource: GoDatasource.id,
          packageName: 'golang.org/x/mod',

          constraints: { go: '1.24.0' },
          constraintsFiltering: 'strict',
        });

        expect(res).toBeDefined();
        expect(res?.releases).toHaveLength(1);
        expect(res?.releases[0].version).toEqual('v0.32.0');
      });

      it('are respected based on a SemVer-style range based on the `%goMod` constraint', async () => {
        const expected: ReleaseResult = {
          releases: [
            // Go 1.24
            {
              version: 'v0.32.0',
              constraints: {
                '%goMod': ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              constraints: {
                '%goMod': ['1.24.1'],
              },
            },
            // Go 1.25
            {
              version: 'v0.34.0',
              constraints: {
                '%goMod': ['1.25.0'],
              },
            },
          ],
        };

        getReleasesProxyMock.mockResolvedValue(expected);

        const res = await getPkgReleases({
          datasource: GoDatasource.id,
          packageName: 'golang.org/x/mod',
          constraints: { '%goMod': '~1.24.x' },
          constraintsFiltering: 'strict',
          constraintsVersioning: {
            '%goMod': 'semver-coerced',
          },
        });

        expect(res).toBeDefined();
        expect(res?.releases).toHaveLength(2);
        expect(res?.releases[0].version).toEqual('v0.32.0');
        expect(res?.releases[1].version).toEqual('v0.33.0');
      });
    });
  });

  describe('package cache', () => {
    const publicProxyUrl = 'https://proxy.golang.org';
    const privateProxyUrl = 'https://artifactory.example.com/api/go/go';

    let setCache: MockInstance<typeof packageCache.setWithRawTtl>;

    beforeEach(() => {
      setCache = vi.spyOn(packageCache, 'setWithRawTtl');
      getReleasesProxyMock.mockResolvedValue({ releases: [] });
    });

    afterEach(() => {
      setCache.mockRestore();
      GlobalConfig.reset();
    });

    it('writes a single entry per releases lookup', async () => {
      vi.stubEnv('GOPROXY', publicProxyUrl);

      await datasource.getReleases({ packageName: 'golang.org/foo/bar' });

      expect(setCache).toHaveBeenCalledOnce();
    });

    it('does not cache releases for modules matching GOPRIVATE', async () => {
      vi.stubEnv('GOPRIVATE', 'golang.org/foo/*');

      await datasource.getReleases({ packageName: 'golang.org/foo/bar' });

      expect(setCache).not.toHaveBeenCalled();
    });

    it('does not cache releases of modules served by a private proxy', async () => {
      vi.stubEnv('GOPROXY', privateProxyUrl);

      await datasource.getReleases({ packageName: 'golang.org/foo/bar' });

      expect(setCache).not.toHaveBeenCalled();
    });

    it('caches releases of modules served by a private proxy if cachePrivatePackages is enabled', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      vi.stubEnv('GOPROXY', privateProxyUrl);

      await datasource.getReleases({ packageName: 'golang.org/foo/bar' });

      expect(setCache).toHaveBeenCalledOnce();
    });

    it('does not cache digests for modules matching GOPRIVATE', async () => {
      vi.stubEnv('GOPRIVATE', 'gitlab.com/group/*');
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, Fixtures.get('go-get-gitlab.html'));
      getDigestMocks['gitlab-tags'].mockResolvedValue(
        'abcdefabcdefabcdefabcdef',
      );

      await datasource.getDigest(
        { packageName: 'gitlab.com/group/subgroup' },
        undefined,
      );

      expect(setCache).not.toHaveBeenCalled();
    });

    it('caches digests for public modules', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get('/group/subgroup?go-get=1')
        .reply(200, Fixtures.get('go-get-gitlab.html'));
      getDigestMocks['gitlab-tags'].mockResolvedValue(
        'abcdefabcdefabcdefabcdef',
      );

      await datasource.getDigest(
        { packageName: 'gitlab.com/group/subgroup' },
        undefined,
      );

      expect(setCache).toHaveBeenCalledOnce();
    });
  });
});
