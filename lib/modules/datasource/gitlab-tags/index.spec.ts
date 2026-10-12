import * as httpMock from '~test/http-mock.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { GitlabTagsDatasource } from './index.ts';

const datasource = GitlabTagsDatasource.id;

describe('modules/datasource/gitlab-tags/index', () => {
  describe('getReleases', () => {
    it('returns tags from custom registry', async () => {
      const body = [
        {
          name: 'v1.0.0',
          commit: {
            id: 'abc100',
            created_at: '2020-03-04T12:01:37.000-06:00',
          },
        },
        {
          name: 'v1.1.0',
          commit: {
            id: 'abc110',
            created_at: '',
          },
        },
        {
          name: 'v1.1.1',
          commit: {
            id: 'abc111',
            created_at: '',
          },
        },
      ];
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      });
      expect(res).toEqual({
        registryUrl: 'https://gitlab.company.com/api/v4',
        releases: [
          {
            gitRef: 'v1.0.0',
            releaseTimestamp: '2020-03-04T18:01:37.000Z',
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
        sourceUrl: 'https://gitlab.company.com/some/dep2',
      });
    });

    it('returns tags from custom registry in sub path', async () => {
      const body = [
        {
          name: 'v1.0.0',
          commit: {
            id: 'abc100',
            created_at: '2020-03-04T12:01:37.000-06:00',
          },
        },
        {
          name: 'v1.1.0',
          commit: {
            id: 'abc110',
            created_at: '',
          },
        },
        {
          name: 'v1.1.1',
          commit: {
            id: 'abc111',
            created_at: '',
          },
        },
      ];
      httpMock
        .scope('https://my.company.com/gitlab')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://my.company.com/gitlab'],
        packageName: 'some/dep2',
      });
      expect(res).toEqual({
        registryUrl: 'https://my.company.com/gitlab',
        releases: [
          {
            gitRef: 'v1.0.0',
            releaseTimestamp: '2020-03-04T18:01:37.000Z',
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
        sourceUrl: 'https://my.company.com/gitlab/some/dep2',
      });
    });

    it('returns tags with default registry', async () => {
      const body = [
        { name: 'v1.0.0', commit: { id: 'abc100', created_at: '' } },
        { name: 'v1.1.0', commit: { id: 'abc110', created_at: '' } },
      ];
      httpMock
        .scope('https://gitlab.com')
        .get('/api/v4/projects/some%2Fdep2/repository/tags?per_page=100')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource,
        packageName: 'some/dep2',
      });
      expect(res).toEqual({
        registryUrl: 'https://gitlab.com',
        releases: [
          {
            gitRef: 'v1.0.0',
            version: 'v1.0.0',
          },
          {
            gitRef: 'v1.1.0',
            version: 'v1.1.0',
          },
        ],
        sourceUrl: 'https://gitlab.com/some/dep2',
      });
    });
  });

  describe('getDigest', () => {
    it('returns commits from gitlab installation', async () => {
      const digest = 'abcd00001234';
      const body = [
        {
          id: digest,
          created_at: '2020-03-04T12:01:37.000-06:00',
        },
      ];
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(200, body);
      const res = await getDigest({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      });
      expect(res).toBe(digest);
    });

    it('url-encodes refs containing slashes', async () => {
      const digest = 'abcd00001234';
      httpMock
        .scope('https://gitlab.company.com')
        .get(
          '/api/v4/projects/some%2Fdep2/repository/commits/release%2F1.0%23x',
        )
        .reply(200, {
          id: digest,
          created_at: '2020-03-04T12:01:37.000-06:00',
        });
      const res = await getDigest(
        {
          datasource,
          registryUrls: ['https://gitlab.company.com/api/v4/'],
          packageName: 'some/dep2',
        },
        'release/1.0#x',
      );
      expect(res).toBe(digest);
    });

    it('returns commits from gitlab installation for a specific branch', async () => {
      const digest = 'abcd00001234';
      const body = {
        id: digest,
        created_at: '2020-03-04T12:01:37.000-06:00',
      };
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits/branch')
        .reply(200, body);
      const res = await getDigest(
        {
          datasource,
          registryUrls: ['https://gitlab.company.com/api/v4/'],
          packageName: 'some/dep2',
        },
        'branch',
      );
      expect(res).toBe(digest);
    });

    it('caches the digest of a branch separately from the latest commit', async () => {
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
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(200, [
          { id: 'latest-sha', created_at: '2020-03-04T12:01:37.000-06:00' },
        ])
        .get('/api/v4/projects/some%2Fdep2/repository/commits/branch')
        .reply(200, {
          id: 'branch-sha',
          created_at: '2020-03-04T12:01:37.000-06:00',
        });
      const config = {
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      };

      await expect(getDigest(config)).resolves.toBe('latest-sha');
      await expect(getDigest(config, 'branch')).resolves.toBe('branch-sha');
    });

    it('returns null from gitlab installation with no commits', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(200, []);
      const res = await getDigest({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      });
      expect(res).toBeNull();
    });

    it('returns null from gitlab installation with unknown branch', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits/unknown-branch')
        .reply(404, '}');
      const res = await getDigest(
        {
          datasource,
          registryUrls: ['https://gitlab.company.com/api/v4/'],
          packageName: 'some/dep2',
        },
        'unknown-branch',
      );
      expect(res).toBeNull();
    });

    it('throws ExternalHostError on server errors', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(502);
      await expect(
        getDigest({
          datasource,
          registryUrls: ['https://gitlab.company.com/api/v4/'],
          packageName: 'some/dep2',
        }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('rethrows other errors', async () => {
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits/branch')
        .reply(403);
      await expect(
        getDigest(
          {
            datasource,
            registryUrls: ['https://gitlab.company.com/api/v4/'],
            packageName: 'some/dep2',
          },
          'branch',
        ),
      ).rejects.toThrow('403');
    });

    it('returns the stale cached digest when the lookup fails', async () => {
      vi.spyOn(packageCache, 'get').mockResolvedValue({
        cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        value: 'stale-sha',
      });
      const setSpy = vi
        .spyOn(packageCache, 'setWithRawTtl')
        .mockResolvedValue();
      httpMock
        .scope('https://gitlab.company.com')
        .get('/api/v4/projects/some%2Fdep2/repository/commits?per_page=1')
        .reply(502);
      const res = await getDigest({
        datasource,
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        packageName: 'some/dep2',
      });
      expect(res).toBe('stale-sha');
      expect(setSpy).not.toHaveBeenCalled();
    });
  });
});
