import { codeBlock } from 'common-tags';
import type { MockInstance } from 'vitest';
import { Fixtures } from '~test/fixtures.ts';
import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as githubGraphql from '../../../util/github/graphql/index.ts';
import { HttpError } from '../../../util/http/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { GithubReleasesDatasource } from '../github-releases/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GoProxyDatasource, getTagPrefix } from './releases-goproxy.ts';

const datasource = new GoProxyDatasource();

describe('modules/datasource/go/releases-goproxy', () => {
  const githubGetReleases = vi.spyOn(
    GithubReleasesDatasource.prototype,
    'getReleases',
  );

  const githubGetTags = vi.spyOn(GithubTagsDatasource.prototype, 'getReleases');

  it('encodeCase', () => {
    expect(datasource.encodeCase('foo')).toBe('foo');
    expect(datasource.encodeCase('Foo')).toBe('!foo');
    expect(datasource.encodeCase('FOO')).toBe('!f!o!o');
  });

  it.each`
    goModule                                          | tags                                          | expected
    ${'github.com/stretchr/testify'}                  | ${['v1.11.1', 'v1.12.0']}                     | ${''}
    ${'github.com/google/btree/v2'}                   | ${['v2.0.0']}                                 | ${''}
    ${'github.com/aws/aws-sdk-go-v2/service/s3'}      | ${['service/s3/v1.100.0', 'v1.30.0']}         | ${'service/s3/'}
    ${'github.com/aws/aws-sdk-go-v2/service/s3/v2'}   | ${['service/s3/v2.0.0']}                      | ${'service/s3/'}
    ${'sigs.k8s.io/controller-runtime/tools/envtest'} | ${['tools/envtest/v0.19.0']}                  | ${'tools/envtest/'}
    ${'cloud.google.com/go/storage'}                  | ${['storage/v1.40.0', 'v0.110.0']}            | ${'storage/'}
    ${'gopkg.in/yaml.v3'}                             | ${['v3.0.1']}                                 | ${''}
    ${'k8s.io/api'}                                   | ${['v0.36.3']}                                | ${''}
    ${'github.com/prometheus/prometheus'}             | ${['v3.5.0']}                                 | ${''}
    ${'github.com/containerd/containerd/v2'}          | ${['v2.0.0']}                                 | ${''}
    ${'github.com/traefik/traefik/v3'}                | ${['v3.1.0']}                                 | ${''}
    ${'github.com/foo/bar/baz'}                       | ${[]}                                         | ${''}
    ${'github.com/foo/bar/baz'}                       | ${['baz/not-a-version', 'baz/prefix/v1.0.0']} | ${''}
  `(
    'getTagPrefix($goModule) === "$expected"',
    ({
      goModule,
      tags,
      expected,
    }: {
      goModule: string;
      tags: string[];
      expected: string;
    }) => {
      expect(getTagPrefix(goModule, tags)).toBe(expected);
    },
  );

  describe('requests', () => {
    const baseUrl = 'https://proxy.golang.org';
    const packageName = 'github.com/go-kit/kit';

    it('listVersions', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/list')
        .reply(200, Fixtures.get('go-kit.list.txt'));

      const versions = await datasource.listVersions(baseUrl, packageName);

      expect(versions).not.toBeEmpty();
      expect(versions).toHaveLength(10);
    });

    it('versionInfo', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/v0.5.0.info')
        .reply(200, { Version: 'v0.5.0', Time: '2017-06-08T17:28:36Z' });

      const release = await datasource.versionInfo(
        baseUrl,
        packageName,
        'v0.5.0',
      );

      expect(release).toEqual({
        version: 'v0.5.0',
        releaseTimestamp: '2017-06-08T17:28:36.000Z',
      });
    });
  });

  describe('getReleases', () => {
    const baseUrl = 'https://proxy.golang.org';

    let githubQueryReleases: MockInstance<typeof githubGraphql.queryReleases>;

    beforeEach(() => {
      githubQueryReleases = vi.spyOn(githubGraphql, 'queryReleases');
      githubQueryReleases.mockResolvedValue([]);
    });

    it('handles direct', async () => {
      vi.stubEnv('GOPROXY', 'direct');

      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
      });
      githubGetReleases.mockResolvedValueOnce({ releases: [] });

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
      });
    });

    it('skips GONOPROXY and GOPRIVATE packages', async () => {
      vi.stubEnv('GOPROXY', baseUrl);
      vi.stubEnv('GOPRIVATE', 'github.com/google/*');

      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
      });
      githubGetReleases.mockResolvedValueOnce({ releases: [] });

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
      });
    });

    it('fetches release data from goproxy', async () => {
      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v1.0.0 2018-08-13T15:31:12Z
            v1.0.1   \n
            v1.28.1-20230721020619-4464c06fa399.4
          `,
        )
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v1.0.0',
            releaseTimestamp: '2018-08-13T15:31:12.000Z',
          },
          {
            version: 'v1.0.1',
            releaseTimestamp: '2019-10-16T16:15:28.000Z',
          },
          {
            version: 'v1.28.1-20230721020619-4464c06fa399.4',
            releaseTimestamp: '2023-07-21T02:06:19.000Z',
            newDigest: '4464c06fa399',
          },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.1' },
      });
    });

    it('resolves sourceUrl from goproxy Origin without calling the vanity domain', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/k8s.io/api`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v0.28.0 2023-08-15T19:57:34Z
            v0.36.3 2026-07-23T01:42:44Z
          `,
        )
        .get('/@latest')
        .reply(200, {
          Version: 'v0.36.3',
          Time: '2026-07-23T01:42:44Z',
          Origin: {
            VCS: 'git',
            URL: 'https://github.com/kubernetes/api.git',
          },
        })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'k8s.io/api',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v0.28.0',
            releaseTimestamp: '2023-08-15T19:57:34.000Z',
          },
          {
            version: 'v0.36.3',
            releaseTimestamp: '2026-07-23T01:42:44.000Z',
          },
        ],
        sourceUrl: 'https://github.com/kubernetes/api',
        tags: { latest: 'v0.36.3' },
      });
    });

    it('prefers the GitHub Release timestamp over the commit timestamp', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/stretchr/testify`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v1.11.1 2026-05-01T10:00:00Z
            v1.12.0 2026-06-10T14:10:43Z
          `,
        )
        .get('/@latest')
        .reply(200, { Version: 'v1.12.0' })
        .get('/v2/@v/list')
        .reply(404);

      githubQueryReleases.mockResolvedValueOnce([
        {
          version: 'v1.12.0',
          releaseTimestamp: '2026-08-17T09:00:00.000Z' as Timestamp,
          url: 'https://github.com/stretchr/testify/releases/tag/v1.12.0',
        },
      ]);

      const res = await datasource.getReleases({
        packageName: 'github.com/stretchr/testify',
      });

      expect(githubQueryReleases).toHaveBeenCalledWith(
        { packageName: 'stretchr/testify', registryUrl: 'https://github.com' },
        expect.anything(),
      );
      expect(res).toEqual({
        releases: [
          {
            version: 'v1.11.1',
            releaseTimestamp: '2026-05-01T10:00:00.000Z',
          },
          {
            version: 'v1.12.0',
            releaseTimestamp: '2026-08-17T09:00:00.000Z',
          },
        ],
        sourceUrl: 'https://github.com/stretchr/testify',
        tags: { latest: 'v1.12.0' },
      });
    });

    it('keeps the commit timestamp when the GitHub Release is older', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0 2018-08-13T15:31:12Z')
        .get('/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('/v2/@v/list')
        .reply(404);

      githubQueryReleases.mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          releaseTimestamp: '2018-08-13T15:00:00.000Z' as Timestamp,
          url: 'https://github.com/google/btree/releases/tag/v1.0.0',
        },
        {
          version: 'v0.9.0',
          releaseTimestamp: '2026-08-17T09:00:00.000Z' as Timestamp,
          url: 'https://github.com/google/btree/releases/tag/v0.9.0',
        },
      ]);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v1.0.0',
            releaseTimestamp: '2018-08-13T15:31:12.000Z',
          },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('matches GitHub Releases of modules in a subdirectory', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/aws/aws-sdk-go-v2/service/s3`)
        .get('/@v/list')
        .reply(200, 'v1.100.0')
        .get('/@v/v1.100.0.info')
        .reply(410)
        .get('/@latest')
        .reply(200, { Version: 'v1.100.0' })
        .get('/v2/@v/list')
        .reply(404);

      githubQueryReleases.mockResolvedValueOnce([
        {
          version: 'service/s3/v1.100.0',
          releaseTimestamp: '2026-08-17T09:00:00.000Z' as Timestamp,
          url: 'https://github.com/aws/aws-sdk-go-v2/releases/tag/service/s3/v1.100.0',
        },
      ]);

      const res = await datasource.getReleases({
        packageName: 'github.com/aws/aws-sdk-go-v2/service/s3',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v1.100.0',
            releaseTimestamp: '2026-08-17T09:00:00.000Z',
          },
        ],
        sourceUrl: 'https://github.com/aws/aws-sdk-go-v2',
        tags: { latest: 'v1.100.0' },
      });
    });

    it('matches GitHub Releases of `+incompatible` versions', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/docker/docker`)
        .get('/@v/list')
        .reply(200, 'v28.0.0+incompatible 2026-06-10T14:10:43Z')
        .get('/@latest')
        .reply(200, { Version: 'v28.0.0+incompatible' })
        .get('/v2/@v/list')
        .reply(404);

      githubQueryReleases.mockResolvedValueOnce([
        {
          version: 'v28.0.0',
          releaseTimestamp: '2026-08-17T09:00:00.000Z' as Timestamp,
          url: 'https://github.com/docker/docker/releases/tag/v28.0.0',
        },
      ]);

      const res = await datasource.getReleases({
        packageName: 'github.com/docker/docker',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v28.0.0+incompatible',
            releaseTimestamp: '2026-08-17T09:00:00.000Z',
          },
        ],
        sourceUrl: 'https://github.com/docker/docker',
        tags: { latest: 'v28.0.0+incompatible' },
      });
    });

    it('skips GitHub Releases lookup for non-GitHub source URLs', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/bitbucket.org/library/go-lib`)
        .get('/@v/list')
        .reply(200, 'v1.0.0 2026-06-10T14:10:43Z')
        .get('/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'bitbucket.org/library/go-lib',
      });

      expect(githubQueryReleases).not.toHaveBeenCalled();
      expect(res).toEqual({
        releases: [
          {
            version: 'v1.0.0',
            releaseTimestamp: '2026-06-10T14:10:43.000Z',
          },
        ],
        sourceUrl: 'https://bitbucket.org/library/go-lib',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('handles GitHub Releases fetch errors', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0 2018-08-13T15:31:12Z')
        .get('/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('/v2/@v/list')
        .reply(404);

      githubQueryReleases.mockRejectedValueOnce(new Error('unknown'));

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          {
            version: 'v1.0.0',
            releaseTimestamp: '2018-08-13T15:31:12.000Z',
          },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('handles timestamp fetch errors', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v1.0.0
            v1.0.1
          `,
        )
        .get('/@v/v1.0.0.info')
        .replyWithError('unknown')
        .get('/@v/v1.0.1.info')
        .reply(410)
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [{ version: 'v1.0.0' }, { version: 'v1.0.1' }],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.1' },
      });
    });

    it.each`
      abortOnError
      ${true}
      ${false}
    `(
      'handles pipe fallback when abortOnError is $abortOnError',
      async ({ abortOnError }: { abortOnError: boolean }) => {
        vi.stubEnv('GOPROXY', `https://example.com|${baseUrl}`);
        hostRules.add({ abortOnError });

        httpMock
          .scope('https://example.com/github.com/google/btree')
          .get('/@v/list')
          .replyWithError('unknown');

        httpMock
          .scope(`${baseUrl}/github.com/google/btree`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v1.0.0
            v1.0.1
          `,
          )
          .get('/@v/v1.0.0.info')
          .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
          .get('/@v/v1.0.1.info')
          .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
          .get('/@latest')
          .reply(200, { Version: 'v1.0.1' })
          .get('/v2/@v/list')
          .reply(404);

        const res = await datasource.getReleases({
          packageName: 'github.com/google/btree',
        });

        expect(res).toEqual({
          releases: [
            { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
            { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
          ],
          sourceUrl: 'https://github.com/google/btree',
          tags: { latest: 'v1.0.1' },
        });
      },
    );

    it('handles pipe fallback across an empty segment', async () => {
      vi.stubEnv('GOPROXY', `https://example.com|,${baseUrl}`);

      httpMock
        .scope('https://example.com/github.com/google/btree')
        .get('/@v/list')
        .replyWithError('unknown');

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200, 'v1.0.0')
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('handles comma fallback', async () => {
      vi.stubEnv(
        'GOPROXY',
        ['https://foo.example.com', 'https://bar.example.com', baseUrl].join(
          ',',
        ),
      );

      httpMock
        .scope('https://foo.example.com/github.com/google/btree')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.example.com/github.com/google/btree')
        .get('/@v/list')
        .reply(410);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
            v1.0.0
            v1.0.1
          `,
        )
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v1.0.1' },
      });
    });

    it('propagates errors other than 404 or 410, without falling back to further URLs', async () => {
      vi.stubEnv(
        'GOPROXY',
        [
          'https://foo.com',
          'https://bar.com',
          'https://baz.com',
          'direct',
        ].join(','),
      );

      httpMock
        .scope('https://foo.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(410);

      httpMock
        .scope('https://baz.com/github.com/foo/bar')
        .get('/@v/list')
        .replyWithError('unknown');

      await expect(
        datasource.getReleases({ packageName: 'github.com/foo/bar' }),
      ).rejects.toThrow(HttpError);
      expect(githubGetTags).not.toHaveBeenCalled();
      expect(githubGetReleases).not.toHaveBeenCalled();
    });

    it('supports "direct" keyword', async () => {
      vi.stubEnv(
        'GOPROXY',
        ['https://foo.com', 'https://bar.com', 'direct'].join(','),
      );

      httpMock
        .scope('https://foo.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(410);

      githubGetTags.mockResolvedValueOnce({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
      });
      githubGetReleases.mockResolvedValueOnce({ releases: [] });

      const res = await datasource.getReleases({
        packageName: 'github.com/foo/bar',
      });

      expect(res).toEqual({
        releases: [
          { gitRef: 'v1.0.0', version: 'v1.0.0' },
          { gitRef: 'v1.0.1', version: 'v1.0.1' },
        ],
        sourceUrl: 'https://github.com/foo/bar',
      });
    });

    it('supports "off" keyword', async () => {
      vi.stubEnv(
        'GOPROXY',
        ['https://foo.com', 'https://bar.com', 'off'].join(','),
      );

      httpMock
        .scope('https://foo.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(404);

      httpMock
        .scope('https://bar.com/github.com/foo/bar')
        .get('/@v/list')
        .reply(410);

      const res = await datasource.getReleases({
        packageName: 'github.com/foo/bar',
      });

      expect(res).toBeNull();
    });

    it('propagates a non-404/410 HTTP error from the primary proxy instead of falling back', async () => {
      vi.stubEnv('GOPROXY', `${baseUrl},direct`);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(500);

      await expect(
        datasource.getReleases({ packageName: 'github.com/google/btree' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(githubGetTags).not.toHaveBeenCalled();
      expect(githubGetReleases).not.toHaveBeenCalled();
    });

    it('propagates a network error from the primary proxy instead of falling back', async () => {
      vi.stubEnv('GOPROXY', `${baseUrl},direct`);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .replyWithError(httpMock.error({ code: 'ETIMEDOUT' }));

      await expect(
        datasource.getReleases({ packageName: 'github.com/google/btree' }),
      ).rejects.toThrow(HttpError);
      expect(githubGetTags).not.toHaveBeenCalled();
      expect(githubGetReleases).not.toHaveBeenCalled();
    });

    it('handles soureUrl fetch errors', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/custom.com/lib/btree`)
        .get('/@v/list')
        .reply(200, ['v1.0.0 2018-08-13T15:31:12.000Z', 'v1.0.1'].join('\n'))
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(404);
      httpMock
        .scope('https://custom.com/lib/btree')
        .get('?go-get=1')
        .reply(500);

      const res = await datasource.getReleases({
        packageName: 'custom.com/lib/btree',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
        ],
        tags: { latest: 'v1.0.1' },
      });
    });

    it.each`
      abortOnError
      ${true}
      ${false}
    `(
      'handles major releases with abortOnError is $abortOnError',
      async ({ abortOnError }: { abortOnError: boolean }) => {
        vi.stubEnv('GOPROXY', baseUrl);
        hostRules.add({ abortOnError });

        httpMock
          .scope(`${baseUrl}/github.com/google/btree`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v1.0.0
            v1.0.1
          `,
          )
          .get('/@v/v1.0.0.info')
          .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
          .get('/@v/v1.0.1.info')
          .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
          .get('/@latest')
          .reply(200, { Version: 'v1.0.1' })
          .get('/v2/@v/list')
          .reply(
            200,
            codeBlock`
            v2.0.0
          `,
          )
          .get('/v2/@v/v2.0.0.info')
          .reply(200, { Version: 'v2.0.0', Time: '2020-10-16T16:15:28Z' })
          .get('/v2/@latest')
          .reply(200, { Version: 'v2.0.0' })
          .get('/v3/@v/list')
          .reply(404);

        const res = await datasource.getReleases({
          packageName: 'github.com/google/btree',
        });

        expect(res).toEqual({
          releases: [
            { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
            { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
            { releaseTimestamp: '2020-10-16T16:15:28.000Z', version: 'v2.0.0' },
          ],
          sourceUrl: 'https://github.com/google/btree',
          tags: { latest: 'v2.0.0' },
        });
      },
    );

    it('handles major releases with 403 status (Artifactory)', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(
          200,
          codeBlock`
          v1.0.0
          v1.0.1
        `,
        )
        .get('/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-08-13T15:31:12Z' })
        .get('/@v/v1.0.1.info')
        .reply(200, { Version: 'v1.0.1', Time: '2019-10-16T16:15:28Z' })
        .get('/@latest')
        .reply(200, { Version: 'v1.0.1' })
        .get('/v2/@v/list')
        .reply(
          200,
          codeBlock`
          v2.0.0
        `,
        )
        .get('/v2/@v/v2.0.0.info')
        .reply(200, { Version: 'v2.0.0', Time: '2020-10-16T16:15:28Z' })
        .get('/v2/@latest')
        .reply(200, { Version: 'v2.0.0' })
        .get('/v3/@v/list')
        .reply(403);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2018-08-13T15:31:12.000Z', version: 'v1.0.0' },
          { releaseTimestamp: '2019-10-16T16:15:28.000Z', version: 'v1.0.1' },
          { releaseTimestamp: '2020-10-16T16:15:28.000Z', version: 'v2.0.0' },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v2.0.0' },
      });
    });

    it('handles gopkg.in major releases', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/gopkg.in/yaml`)
        .get('.v2/@v/list')
        .reply(200, ['v2.3.0', 'v2.4.0', '  \n'].join('\n'))
        .get('.v2/@v/v2.3.0.info')
        .reply(200, { Version: 'v2.3.0', Time: '2020-05-06T23:08:38Z' })
        .get('.v2/@v/v2.4.0.info')
        .reply(200, { Version: 'v2.4.0', Time: '2020-11-17T15:46:20Z' })
        .get('.v2/@latest')
        .reply(200, { Version: 'v2.4.0' })
        .get('.v3/@v/list')
        .reply(
          200,
          ['v1.0.0', 'v2.0.0', 'v3.0.0', 'v3.0.1', 'v4.0.0', '  \n'].join('\n'),
        )
        .get('.v3/@v/v3.0.0.info')
        .reply(200, { Version: 'v3.0.0', Time: '2022-05-21T10:33:21Z' })
        .get('.v3/@v/v3.0.1.info')
        .reply(200, { Version: 'v3.0.1', Time: '2022-05-27T08:35:30Z' })
        .get('.v3/@latest')
        .reply(200, { Version: 'v3.0.1' })
        .get('.v4/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'gopkg.in/yaml.v2',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2020-05-06T23:08:38.000Z', version: 'v2.3.0' },
          { releaseTimestamp: '2020-11-17T15:46:20.000Z', version: 'v2.4.0' },
          { releaseTimestamp: '2022-05-21T10:33:21.000Z', version: 'v3.0.0' },
          { releaseTimestamp: '2022-05-27T08:35:30.000Z', version: 'v3.0.1' },
        ],
        sourceUrl: 'https://github.com/go-yaml/yaml',
        tags: { latest: 'v3.0.1' },
      });
    });

    it('handles gopkg.in major releases from v0', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/gopkg.in/foo`)
        .get('.v0/@v/list')
        .reply(200, ['v0.1.0', 'v0.2.0', '  \n'].join('\n'))
        .get('.v0/@v/v0.1.0.info')
        .reply(200, { Version: 'v0.1.0', Time: '2017-01-01T00:00:00Z' })
        .get('.v0/@v/v0.2.0.info')
        .reply(200, { Version: 'v0.2.0', Time: '2017-02-01T00:00:00Z' })
        .get('.v0/@latest')
        .reply(200, { Version: 'v0.2.0' })
        .get('.v1/@v/list')
        .reply(200, ['v1.0.0', '\n'].join('\n'))
        .get('.v1/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-01-01T00:00:00Z' })
        .get('.v1/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('.v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'gopkg.in/foo.v0',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2017-01-01T00:00:00.000Z', version: 'v0.1.0' },
          { releaseTimestamp: '2017-02-01T00:00:00.000Z', version: 'v0.2.0' },
          { releaseTimestamp: '2018-01-01T00:00:00.000Z', version: 'v1.0.0' },
        ],
        sourceUrl: 'https://github.com/go-foo/foo',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('handles baseURL with slash at the end', async () => {
      vi.stubEnv('GOPROXY', `${baseUrl}/`);

      httpMock
        .scope(`${baseUrl}/gopkg.in/foo`)
        .get('.v0/@v/list')
        .reply(200, ['v0.1.0', 'v0.2.0', '  \n'].join('\n'))
        .get('.v0/@v/v0.1.0.info')
        .reply(200, { Version: 'v0.1.0', Time: '2017-01-01T00:00:00Z' })
        .get('.v0/@v/v0.2.0.info')
        .reply(200, { Version: 'v0.2.0', Time: '2017-02-01T00:00:00Z' })
        .get('.v0/@latest')
        .reply(200, { Version: 'v0.2.0' })
        .get('.v1/@v/list')
        .reply(200, ['v1.0.0', '\n'].join('\n'))
        .get('.v1/@v/v1.0.0.info')
        .reply(200, { Version: 'v1.0.0', Time: '2018-01-01T00:00:00Z' })
        .get('.v1/@latest')
        .reply(200, { Version: 'v1.0.0' })
        .get('.v2/@v/list')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'gopkg.in/foo.v0',
      });

      expect(res).toEqual({
        releases: [
          { releaseTimestamp: '2017-01-01T00:00:00.000Z', version: 'v0.1.0' },
          { releaseTimestamp: '2017-02-01T00:00:00.000Z', version: 'v0.2.0' },
          { releaseTimestamp: '2018-01-01T00:00:00.000Z', version: 'v1.0.0' },
        ],
        sourceUrl: 'https://github.com/go-foo/foo',
        tags: { latest: 'v1.0.0' },
      });
    });

    it('continues if package returns no releases', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200)
        .get('/@latest')
        .reply(404);

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toBeNull();
    });

    it('uses latest if package has no releases', async () => {
      vi.stubEnv('GOPROXY', baseUrl);

      httpMock
        .scope(`${baseUrl}/github.com/google/btree`)
        .get('/@v/list')
        .reply(200)
        .get('/@latest')
        .reply(200, { Version: 'v0.0.0-20230905200255-921286631fa9' });

      const res = await datasource.getReleases({
        packageName: 'github.com/google/btree',
      });

      expect(res).toEqual({
        releases: [
          {
            newDigest: '921286631fa9',
            releaseTimestamp: '2023-09-05T20:02:55.000Z',
            version: 'v0.0.0-20230905200255-921286631fa9',
          },
        ],
        sourceUrl: 'https://github.com/google/btree',
        tags: { latest: 'v0.0.0-20230905200255-921286631fa9' },
      });
    });

    describe('looks up `go` directive requirements if constraintsFiltering=strict', () => {
      it('and returns unfiltered `constraints` in the Release', async () => {
        httpMock
          .scope(`${baseUrl}/golang.org/x/mod`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.32.0
            v0.33.0
            v0.34.0
          `,
          )
          .get('/@v/v0.32.0.info')
          .reply(200, { Version: 'v0.32.0', Time: '2026-01-09T16:07:51Z' })
          .get('/@v/v0.32.0.mod')
          .reply(
            200,
            codeBlock`
            module golang.org/x/mod

            go 1.24.0

            require golang.org/x/tools v0.40.0 // tagx:ignore
          `,
          )
          .get('/@v/v0.33.0.info')
          .reply(200, { Version: 'v0.33.0', Time: '2026-02-09T16:11:19Z' })
          .get('/@v/v0.33.0.mod')
          .reply(
            200,
            codeBlock`
            module golang.org/x/mod

            go 1.24.0

            require golang.org/x/tools v0.41.0 // tagx:ignore
          `,
          )
          .get('/@v/v0.34.0.info')
          .reply(200, { Version: 'v0.34.0', Time: '2026-03-10T01:41:08Z' })
          .get('/@v/v0.34.0.mod')
          .reply(
            200,
            codeBlock`
          module golang.org/x/mod

          go 1.25.0

          require golang.org/x/tools v0.42.0 // tagx:ignore
          `,
          )
          .get('/@latest')
          .reply(200, { Version: 'v0.34.0' })
          .get('/v2/@v/list')
          .reply(404);
        httpMock.scope('https://golang.org/x/mod').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'golang.org/x/mod',
          constraintsFiltering: 'strict',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.32.0',
              releaseTimestamp: '2026-01-09T16:07:51.000Z',
              constraints: {
                ['%goMod']: ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              releaseTimestamp: '2026-02-09T16:11:19.000Z',
              constraints: {
                ['%goMod']: ['1.24.0'],
              },
            },
            {
              version: 'v0.34.0',
              releaseTimestamp: '2026-03-10T01:41:08.000Z',
              constraints: {
                ['%goMod']: ['1.25.0'],
              },
            },
          ],
          tags: { latest: 'v0.34.0' },
        });
      });

      it('handles major version updates', async () => {
        httpMock
          .scope(`${baseUrl}/golang.org/x/mod`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.32.0
            v0.33.0
            v0.34.0
          `,
          )
          .get('/@v/v0.32.0.info')
          .reply(200, { Version: 'v0.32.0', Time: '2026-01-09T16:07:51Z' })
          .get('/@v/v0.32.0.mod')
          .reply(
            200,
            codeBlock`
            module golang.org/x/mod

            go 1.24.0

            require golang.org/x/tools v0.40.0 // tagx:ignore
          `,
          )
          .get('/@v/v0.33.0.info')
          .reply(200, { Version: 'v0.33.0', Time: '2026-02-09T16:11:19Z' })
          .get('/@v/v0.33.0.mod')
          .reply(
            200,
            codeBlock`
            module golang.org/x/mod

            go 1.24.0

            require golang.org/x/tools v0.41.0 // tagx:ignore
          `,
          )
          .get('/@v/v0.34.0.info')
          .reply(200, { Version: 'v0.34.0', Time: '2026-03-10T01:41:08Z' })
          .get('/@v/v0.34.0.mod')
          .reply(
            200,
            codeBlock`
          module golang.org/x/mod

          go 1.25.0

          require golang.org/x/tools v0.42.0 // tagx:ignore
          `,
          )
          .get('/@latest')
          .reply(200, { Version: 'v0.34.0' })
          .get('/v2/@v/list')
          .reply(
            200,
            codeBlock`
          v2.0.0
        `,
          )
          .get('/v2/@v/v2.0.0.info')
          .reply(200, { Version: 'v2.0.0', Time: '2026-04-01T01:41:08Z' })
          .get('/v2/@v/v2.0.0.mod')
          .reply(
            200,
            codeBlock`
          module golang.org/x/mod/v2

          go 1.26.0

          require golang.org/x/tools v0.42.0 // tagx:ignore
          `,
          )
          .get('/v2/@latest')
          .reply(200, { Version: 'v2.0.0' })
          .get('/v3/@v/list')
          .reply(403);

        httpMock.scope('https://golang.org/x/mod').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'golang.org/x/mod',
          constraintsFiltering: 'strict',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.32.0',
              releaseTimestamp: '2026-01-09T16:07:51.000Z',
              constraints: {
                ['%goMod']: ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              releaseTimestamp: '2026-02-09T16:11:19.000Z',
              constraints: {
                ['%goMod']: ['1.24.0'],
              },
            },
            {
              version: 'v0.34.0',
              releaseTimestamp: '2026-03-10T01:41:08.000Z',
              constraints: {
                ['%goMod']: ['1.25.0'],
              },
            },
            {
              version: 'v2.0.0',
              releaseTimestamp: '2026-04-01T01:41:08.000Z',
              constraints: {
                ['%goMod']: ['1.26.0'],
              },
            },
          ],
          tags: { latest: 'v2.0.0' },
        });
      });

      it('handles HTTP errors by omitting constraints on failed HTTP requests', async () => {
        httpMock
          .scope(`${baseUrl}/golang.org/x/mod`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.32.0
            v0.33.0
          `,
          )
          .get('/@v/v0.32.0.info')
          .reply(200, { Version: 'v0.32.0', Time: '2026-01-09T16:07:51Z' })
          .get('/@v/v0.32.0.mod')
          .reply(
            200,
            codeBlock`
            module golang.org/x/mod

            go 1.24.0

            require golang.org/x/tools v0.40.0 // tagx:ignore
          `,
          )
          .get('/@v/v0.33.0.info')
          .reply(200, { Version: 'v0.33.0', Time: '2026-02-09T16:11:19Z' })
          .get('/@v/v0.33.0.mod')
          .reply(429, '')
          .get('/@latest')
          .reply(200, { Version: 'v0.33.0' })
          .get('/v2/@v/list')
          .reply(404);
        httpMock.scope('https://golang.org/x/mod').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'golang.org/x/mod',
          constraintsFiltering: 'strict',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.32.0',
              releaseTimestamp: '2026-01-09T16:07:51.000Z',
              constraints: {
                ['%goMod']: ['1.24.0'],
              },
            },
            {
              version: 'v0.33.0',
              releaseTimestamp: '2026-02-09T16:11:19.000Z',
            },
          ],
          tags: { latest: 'v0.33.0' },
        });
      });

      it('does not set constraints if no `go` directive', async () => {
        httpMock
          .scope(`${baseUrl}/golang.org/x/mod`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.32.0
          `,
          )
          .get('/@v/v0.32.0.info')
          .reply(200, { Version: 'v0.32.0', Time: '2026-01-09T16:07:51Z' })
          .get('/@v/v0.32.0.mod')
          .reply(
            200,
            codeBlock`
            module golang.org/x/mod
          `,
          )
          .get('/@latest')
          .reply(200, { Version: 'v0.32.0' })
          .get('/v2/@v/list')
          .reply(404);
        httpMock.scope('https://golang.org/x/mod').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'golang.org/x/mod',
          constraintsFiltering: 'strict',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.32.0',
              releaseTimestamp: '2026-01-09T16:07:51.000Z',
            },
          ],
          tags: { latest: 'v0.32.0' },
        });
      });

      // TODO #42566
      it.each([
        ['1', '1.0.0'],
        ['1.25.0.1.1', '1.25.0'],
      ])(
        `normalises constraints if not full SemVer \`go\` directive: %s`,
        async (version, expected) => {
          httpMock
            .scope(`${baseUrl}/golang.org/x/mod`)
            .get('/@v/list')
            .reply(
              200,
              codeBlock`
            v0.32.0
          `,
            )
            .get('/@v/v0.32.0.info')
            .reply(200, { Version: 'v0.32.0', Time: '2026-01-09T16:07:51Z' })
            .get('/@v/v0.32.0.mod')
            .reply(
              200,
              codeBlock`
            module golang.org/x/mod

            go ${version}
          `,
            )
            .get('/@latest')
            .reply(200, { Version: 'v0.32.0' })
            .get('/v2/@v/list')
            .reply(404);
          httpMock
            .scope('https://golang.org/x/mod')
            .get('?go-get=1')
            .reply(200);

          const res = await datasource.getReleases({
            packageName: 'golang.org/x/mod',
            constraintsFiltering: 'strict',
          });

          expect(res).toEqual({
            releases: [
              {
                version: 'v0.32.0',
                releaseTimestamp: '2026-01-09T16:07:51.000Z',
                constraints: {
                  '%goMod': [expected],
                },
              },
            ],
            tags: { latest: 'v0.32.0' },
          });
        },
      );

      it('converts minor-only version numbers to include patch of .0', async () => {
        httpMock
          .scope(`${baseUrl}/example.org/pkg`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.1.0
          `,
          )
          .get('/@v/v0.1.0.info')
          .reply(200, { Version: 'v0.1.0', Time: '2019-10-16T16:15:28Z' })
          .get('/@v/v0.1.0.mod')
          .reply(
            200,
            codeBlock`
            module example.org/pkg

            go 1.18
          `,
          )
          .get('/@latest')
          .reply(200, { Version: 'v0.1.0' })
          .get('/v2/@v/list')
          .reply(404);
        httpMock.scope('https://example.org/pkg').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'example.org/pkg',
          constraintsFiltering: 'strict',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.1.0',
              releaseTimestamp: '2019-10-16T16:15:28.000Z',
              constraints: {
                // to allow it to work with full SemVer
                ['%goMod']: ['1.18.0'],
              },
            },
          ],
          tags: { latest: 'v0.1.0' },
        });
      });

      it('skips `toolchain` directive', async () => {
        httpMock
          .scope(`${baseUrl}/example.org/pkg`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.1.0
          `,
          )
          .get('/@v/v0.1.0.info')
          .reply(200, { Version: 'v0.1.0', Time: '2019-10-16T16:15:28.000Z' })
          .get('/@v/v0.1.0.mod')
          .reply(
            200,
            codeBlock`
            module example.org/pkg

            go 1.20.5

            toolchain 1.26.2
          `,
          )
          .get('/@latest')
          .reply(200, { Version: 'v0.1.0' })
          .get('/v2/@v/list')
          .reply(404);
        httpMock.scope('https://example.org/pkg').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'example.org/pkg',
          constraintsFiltering: 'strict',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.1.0',
              releaseTimestamp: '2019-10-16T16:15:28.000Z',
              constraints: {
                ['%goMod']: ['1.20.5'],
              },
            },
          ],
          tags: { latest: 'v0.1.0' },
        });
      });

      it('does not look up `go` directive requirements if constraintsFiltering=none', async () => {
        httpMock
          .scope(`${baseUrl}/example.org/pkg`)
          .get('/@v/list')
          .reply(
            200,
            codeBlock`
            v0.1.0
          `,
          )
          .get('/@v/v0.1.0.info')
          .reply(200, { Version: 'v0.1.0', Time: '2019-10-16T16:15:28.000Z' })
          .get('/@latest')
          .reply(200, { Version: 'v0.1.0' })
          .get('/v2/@v/list')
          .reply(404);
        httpMock.scope('https://example.org/pkg').get('?go-get=1').reply(200);

        const res = await datasource.getReleases({
          packageName: 'example.org/pkg',
          constraints: {
            ['%goMod']: '1.24.0',
          },
          constraintsFiltering: 'none',
        });

        expect(res).toEqual({
          releases: [
            {
              version: 'v0.1.0',
              releaseTimestamp: '2019-10-16T16:15:28.000Z',
            },
          ],
          tags: { latest: 'v0.1.0' },
        });
      });
    });
  });
});
