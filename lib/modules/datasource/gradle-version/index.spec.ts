import { dir as tmpDir } from 'tmp-promise';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { id as versioning } from '../../versioning/gradle/index.ts';
import type { GetPkgReleasesConfig, GetReleasesConfig } from '../index.ts';
import { getPkgReleases } from '../index.ts';
import { GradleVersionDatasource } from './index.ts';

const allResponse = Fixtures.get('all.json');

let config: GetPkgReleasesConfig;

const datasource = GradleVersionDatasource.id;

describe('modules/datasource/gradle-version/index', () => {
  describe('package caching', () => {
    let cacheDir: Awaited<ReturnType<typeof tmpDir>>;

    beforeEach(async () => {
      GlobalConfig.reset();
      GlobalConfig.set({ cachePrivatePackages: false });
      memCache.init();
      cacheDir = await tmpDir({ unsafeCleanup: true });
      await packageCache.init({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      await packageCache.cleanup({});
      await cacheDir.cleanup();
      memCache.reset();
      GlobalConfig.reset();
    });

    it('preserves the administrator override for custom feeds', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      httpMock
        .scope('https://private.example')
        .get('/versions/all')
        .reply(200, [{ version: '8.0' }]);
      const lookup = {
        datasource,
        versioning,
        packageName: 'gradle',
        registryUrls: ['https://private.example/versions/all'],
      };

      const first = await getPkgReleases(lookup);
      memCache.init();
      const second = await getPkgReleases(lookup);

      expect(first?.releases).toEqual([{ version: '8.0', gitRef: 'v8.0.0' }]);
      expect(second).toEqual(first);
    });

    it('does not use stale custom-feed data on an upstream error', async () => {
      const registryUrl = 'https://private.example/versions/all';
      await packageCache.setWithRawTtl(
        'datasource-gradle-version',
        `cache-decorator:${registryUrl}`,
        {
          cachedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          value: { releases: [{ version: '7.0' }] },
        },
        120,
      );
      httpMock.scope('https://private.example').get('/versions/all').reply(500);

      await expect(
        new GradleVersionDatasource().getReleases(
          partial<GetReleasesConfig>({ registryUrl }),
        ),
      ).rejects.toThrow(ExternalHostError);
    });

    it('leaves invalid destinations to normal error handling', async () => {
      await expect(
        new GradleVersionDatasource().getReleases(
          partial<GetReleasesConfig>({ registryUrl: 'invalid' }),
        ),
      ).rejects.toThrow('Invalid URL');
    });

    it.each([
      'https://services.gradle.org/versions/all',
      'HTTPS://SERVICES.GRADLE.ORG:443/versions/all',
      'https://services.gradle.org/versions/all///',
      'https://services.gradle.org/versions/./all',
      'https://services.gradle.org/other/%2e%2e/versions/all',
      'https://services.gradle.org/versions/all#',
      'https://services.gradle.org/versions/all?',
    ])('reuses the public feed for %s', async (registryUrl) => {
      httpMock
        .scope('https://services.gradle.org')
        .get('/versions/all')
        .reply(200, [{ version: '8.0' }]);
      const lookup = {
        datasource,
        versioning,
        packageName: 'gradle',
        registryUrls: [registryUrl],
      };

      const first = await getPkgReleases(lookup);
      memCache.init();
      const second = await getPkgReleases(lookup);

      expect(first?.releases).toEqual([{ version: '8.0', gitRef: 'v8.0.0' }]);
      expect(second).toEqual(first);
    });

    it.each([
      'https://private.example/versions/all',
      'http://services.gradle.org/versions/all',
      'https://services.gradle.org:8443/versions/all',
      'https://services.gradle.org.evil.example/versions/all',
      'https://user:password@services.gradle.org/versions/all',
      'https://services.gradle.org/versions/all?token=secret',
      'https://services.gradle.org/versions/all#token=secret',
      'https://services.gradle.org/versions/all/extra',
      'https://services.gradle.org/versions/all.git',
      'https://services.gradle.org/versions/%61ll',
      'https://services.gradle.org/versions/all%2fextra',
      'https://services.gradle.org/versions/ALL',
      'https://downloads.gradle.org/versions/all',
    ])(
      'bypasses existing entries and new writes for %s',
      async (registryUrl) => {
        const url = parseUrl(registryUrl)!;
        const key = `cache-decorator:${registryUrl}`;
        await packageCache.setWithRawTtl(
          'datasource-gradle-version',
          key,
          {
            cachedAt: new Date().toISOString(),
            value: { releases: [{ version: '7.0' }] },
          },
          60,
        );
        httpMock
          .scope(url.origin)
          .get(url.pathname + url.search)
          .reply(200, [{ version: '8.0' }]);
        httpMock
          .scope(url.origin)
          .get(url.pathname + url.search)
          .reply(200, [{ version: '9.0' }]);
        const lookup = {
          datasource,
          versioning,
          packageName: 'gradle',
          registryUrls: [registryUrl],
        };

        const first = await getPkgReleases(lookup);
        memCache.init();
        const second = await getPkgReleases(lookup);

        expect(first?.releases).toEqual([{ version: '8.0', gitRef: 'v8.0.0' }]);
        expect(second?.releases).toEqual([
          { version: '9.0', gitRef: 'v9.0.0' },
        ]);
        await expect(
          packageCache.get('datasource-gradle-version', key),
        ).resolves.toEqual({
          cachedAt: expect.any(String),
          value: { releases: [{ version: '7.0' }] },
        });
      },
    );
  });

  describe('getReleases', () => {
    beforeEach(() => {
      config = {
        datasource,
        versioning,
        packageName: 'abc',
      };
    });

    it('processes real data', async () => {
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(200, allResponse);
      const res = await getPkgReleases(config);
      expect(res).toEqual({
        homepage: 'https://gradle.org',
        sourceUrl: 'https://github.com/gradle/gradle',
        registryUrl: 'https://services.gradle.org/versions/all',
        releases: [
          {
            version: '0.7',
            gitRef: 'v0.7.0',
            releaseTimestamp: '2009-07-20T06:50:13.000Z',
          },
          {
            version: '0.8',
            gitRef: 'v0.8.0',
            releaseTimestamp: '2009-09-28T12:01:59.000Z',
          },
          {
            version: '0.9-rc-1',
            gitRef: 'v0.9.0-RC1',
            releaseTimestamp: '2010-08-03T21:04:33.000Z',
          },
          {
            version: '0.9.1',
            gitRef: 'v0.9.1',
            releaseTimestamp: '2011-01-02T00:40:57.000Z',
          },
          {
            version: '1.0-milestone-4',
            gitRef: 'v1.0.0-M4',
            isDeprecated: true,
            releaseTimestamp: '2011-07-28T08:38:22.000Z',
          },
          {
            version: '1.0-milestone-8a',
            gitRef: 'v1.0.0-M8a',
            releaseTimestamp: '2012-02-20T17:53:57.000Z',
          },
          {
            version: '6.8.3',
            gitRef: 'v6.8.3',
            releaseTimestamp: '2021-02-22T16:13:28.000Z',
          },
          {
            version: '7.0-milestone-3',
            gitRef: 'v7.0.0-M3',
            releaseTimestamp: '2021-03-13T01:03:21.000Z',
          },
          {
            version: '7.0-rc-1',
            gitRef: 'v7.0.0-RC1',
            releaseTimestamp: '2021-03-23T01:02:30.000Z',
          },
        ],
      });
    });

    it('calls configured registryUrls', async () => {
      httpMock.scope('https://foo.bar').get('/').reply(200, allResponse);

      httpMock
        .scope('http://baz.qux')
        .get('/')
        .reply(200, [
          { version: '1.0.1' },
          { version: '1.0.2', buildTime: 'abc' },
        ]);

      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://foo.bar', 'http://baz.qux'],
      });
      expect(res).toEqual({
        homepage: 'https://gradle.org',
        sourceUrl: 'https://github.com/gradle/gradle',
        releases: [
          {
            version: '0.7',
            gitRef: 'v0.7.0',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2009-07-20T06:50:13.000Z',
          },
          {
            version: '0.8',
            gitRef: 'v0.8.0',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2009-09-28T12:01:59.000Z',
          },
          {
            version: '0.9-rc-1',
            gitRef: 'v0.9.0-RC1',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2010-08-03T21:04:33.000Z',
          },
          {
            version: '0.9.1',
            gitRef: 'v0.9.1',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2011-01-02T00:40:57.000Z',
          },
          {
            version: '1.0-milestone-4',
            gitRef: 'v1.0.0-M4',
            isDeprecated: true,
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2011-07-28T08:38:22.000Z',
          },
          {
            version: '1.0-milestone-8a',
            gitRef: 'v1.0.0-M8a',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2012-02-20T17:53:57.000Z',
          },
          {
            version: '1.0.1',
            gitRef: 'v1.0.1',
            registryUrl: 'http://baz.qux',
          },
          {
            version: '1.0.2',
            gitRef: 'v1.0.2',
            registryUrl: 'http://baz.qux',
          },
          {
            version: '6.8.3',
            gitRef: 'v6.8.3',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2021-02-22T16:13:28.000Z',
          },
          {
            version: '7.0-milestone-3',
            gitRef: 'v7.0.0-M3',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2021-03-13T01:03:21.000Z',
          },
          {
            version: '7.0-rc-1',
            gitRef: 'v7.0.0-RC1',
            registryUrl: 'https://foo.bar',
            releaseTimestamp: '2021-03-23T01:02:30.000Z',
          },
        ],
      });
    });

    it('handles empty releases', async () => {
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(200, []);

      const res = await getPkgReleases(config);
      expect(res).toBeNull();
    });

    it('handles errors', async () => {
      expect.assertions(2);
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(500);

      httpMock.scope('http://baz.qux').get('/').reply(429);

      const gradleVersionDatasource = new GradleVersionDatasource();

      await expect(
        gradleVersionDatasource.getReleases(
          partial<GetReleasesConfig>({
            registryUrl: 'https://services.gradle.org/versions/all',
          }),
        ),
      ).rejects.toThrow(ExternalHostError);

      await expect(
        gradleVersionDatasource.getReleases(
          partial<GetReleasesConfig>({
            registryUrl: 'http://baz.qux',
          }),
        ),
      ).rejects.toThrow(ExternalHostError);
    });
  });
});
