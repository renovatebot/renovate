import { promisify } from 'node:util';
import { zstdCompress as _zstdCompress } from 'node:zlib';
import { DateTime } from 'luxon';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { getPkgReleases } from '../index.ts';
import { datasource, defaultRegistryUrl } from './common.ts';
import { CondaDatasource } from './index.ts';

const zstdCompress = promisify(_zstdCompress);

/** A conda channel index, trimmed to the packages the tests need. */
const repodataJson = JSON.stringify({
  info: {
    subdir: 'linux-64',
  },
  packages: {
    'python-3.13.0-h0.tar.bz2': {
      name: 'python',
      version: '3.13.0',
      build: 'h0',
      timestamp: 1700000000000,
    },
    'python-3.14.5-h0.tar.bz2': {
      name: 'python',
      version: '3.14.5',
      build: 'h0',
      timestamp: 1718000000000,
    },
    'numpy-2.0.0-h0.tar.bz2': {
      name: 'numpy',
      version: '2.0.0',
      build: 'h0',
    },
    'scipy-1.0.0-h0.tar.bz2': {
      name: 'scipy',
      version: '1.0.0',
      build: 'h0',
    },
    'scipy-1.1.0-h0.tar.bz2': {
      name: 'scipy',
      version: '1.1.0',
      build: 'h0',
      timestamp: 1719000000000,
    },
    'scipy-1.2.0-h0.tar.bz2': {
      name: 'scipy',
      version: '1.2.0',
      build: 'h0',
      timestamp: 1700000000000,
    },
    'scipy-1.3.0-h0.tar.bz2': {
      name: 'scipy',
      version: '1.3.0',
      build: 'h0',
      timestamp: 1700000000,
    },
  },
  'packages.conda': {
    'python-3.14.5-h1.conda': {
      name: 'python',
      version: '3.14.5',
      build: 'h1',
      timestamp: 1718000000000,
    },
    'python-3.15.0-h0.conda': {
      name: 'python',
      version: '3.15.0',
      build: 'h0',
      timestamp: 1719000000000,
    },
    'scipy-1.0.0-h1.conda': {
      name: 'scipy',
      version: '1.0.0',
      build: 'h1',
      timestamp: 1718000000000,
    },
    'scipy-1.1.0-h1.conda': {
      name: 'scipy',
      version: '1.1.0',
      build: 'h1',
      timestamp: 1700000000000,
    },
    'scipy-1.2.0-h1.conda': {
      name: 'scipy',
      version: '1.2.0',
      build: 'h1',
    },
  },
});

const packageName = 'main/pytest';
const depUrl = `/${packageName}`;

describe('modules/datasource/conda/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(404);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(depUrl)
        .reply(200, { versions: [] });
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).resolves.toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(depUrl)
        .reply(200, Fixtures.get('pytest.json'));
      const res = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(res).toMatchObject({
        homepage: 'http://anaconda.org/anaconda/pytest',
        sourceUrl: 'https://github.com/pytest-dev/pytest',
        releases: [
          { version: '2.3.3' },
          { version: '2.3.4' },
          { version: '2.3.5' },
          { version: '2.4.2' },
          { version: '2.5.1' },
          { version: '2.5.2' },
          { version: '2.6.0' },
          { version: '2.6.1' },
          { version: '2.6.2' },
          { version: '2.6.3' },
          { version: '2.6.4' },
          { version: '2.7.0' },
          { version: '2.7.1' },
          { version: '2.7.2' },
          { version: '2.8.0' },
          { version: '2.8.1' },
          { version: '2.8.5' },
          { version: '2.9.1' },
          { version: '2.9.2' },
          { version: '3.0.3' },
          { version: '3.0.4' },
          { version: '3.0.5' },
          { version: '3.0.6' },
          { version: '3.0.7' },
          { version: '3.1.1' },
          { version: '3.1.2' },
          { version: '3.1.3' },
          { version: '3.2.1' },
          { version: '3.2.5' },
          { version: '3.3.0' },
          { version: '3.3.2' },
          { version: '3.4.0' },
          { version: '3.4.1' },
          { version: '3.4.2' },
          { version: '3.5.0' },
          { version: '3.5.1' },
          { version: '3.6.0' },
          { version: '3.6.1' },
          { version: '3.6.2' },
          { version: '3.6.3' },
          { version: '3.6.4' },
          { version: '3.7.1' },
          { version: '3.7.2' },
          { version: '3.7.3' },
          { version: '3.7.4' },
          { version: '3.8.0' },
          { version: '3.8.1' },
          { version: '3.8.2' },
          { version: '3.9.1' },
          { version: '3.9.3' },
          { version: '3.10.0', releaseTimestamp: '2020-02-28T11:46:01.948Z' },
          { version: '3.10.1' },
          { version: '4.0.0' },
          { version: '4.0.1' },
          { version: '4.0.2' },
          { version: '4.1.0' },
          { version: '4.1.1' },
          { version: '4.2.0' },
          { version: '4.2.1' },
          { version: '4.3.0' },
          { version: '4.3.1' },
          { version: '4.4.0' },
          { version: '4.4.1' },
          { version: '4.4.2' },
          { version: '4.5.0' },
          { version: '4.6.2' },
          { version: '4.6.11' },
          { version: '5.0.0' },
          { version: '5.0.1' },
          { version: '5.1.1' },
          { version: '5.1.2' },
          { version: '5.2.0' },
          { version: '5.2.1' },
          { version: '5.2.2' },
          { version: '5.2.4' },
          { version: '5.3.0' },
          { version: '5.3.1' },
          { version: '5.3.2' },
          { version: '5.3.4' },
          { version: '5.3.5' },
          { version: '5.4.1' },
          { version: '5.4.2' },
          { version: '5.4.3' },
          { version: '6.0.1' },
          { version: '6.0.2' },
          { version: '6.1.0' },
          { version: '6.1.1' },
          { version: '6.1.2' },
          { version: '6.2.0' },
          { version: '6.2.1' },
          { version: '6.2.2' },
          { version: '6.2.3' },
          { version: '6.2.4' },
          { version: '6.2.5' },
        ],
      });
    });

    it('returns null without registryUrl', async () => {
      const condaDatasource = new CondaDatasource();
      const res = await condaDatasource.getReleases({
        registryUrl: '',
        packageName,
      });
      expect(res).toBeNull();
    });

    it('handles null html_url and dev_url without throwing', async () => {
      const packageName = 'pytest';
      httpMock
        .scope('https://api.anaconda.org/package/conda-forge')
        .get(`/${packageName}`)
        .reply(200, {
          html_url: null,
          dev_url: null,
          versions: ['1.0.0'],
          files: [],
        });
      const res = await getPkgReleases({
        registryUrls: ['https://api.anaconda.org/package/conda-forge'],
        datasource,
        packageName,
      });
      expect(res).toMatchObject({ releases: [{ version: '1.0.0' }] });
      expect(res?.homepage).toBeUndefined();
      expect(res?.sourceUrl).toBeUndefined();
    });

    it('supports multiple custom datasource urls', async () => {
      const packageName = 'pytest';
      httpMock
        .scope('https://api.anaconda.org/package/rapids')
        .get(`/${packageName}`)
        .reply(404);
      httpMock
        .scope('https://api.anaconda.org/package/conda-forge')
        .get(`/${packageName}`)
        .reply(200, {
          html_url: 'http://anaconda.org/anaconda/pytest',
          dev_url: 'https://github.com/pytest-dev/pytest/',
          versions: ['2.7.0', '2.5.1', '2.6.0'],
          files: [],
        });
      const config = {
        registryUrls: [
          'https://api.anaconda.org/package/rapids',
          'https://api.anaconda.org/package/conda-forge',
          'https://api.anaconda.org/package/nvidia',
        ],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        packageName,
      });
      expect(res).toMatchObject({
        homepage: 'http://anaconda.org/anaconda/pytest',
        registryUrl: 'https://api.anaconda.org/package/conda-forge',
        releases: [
          { version: '2.5.1' },
          { version: '2.6.0' },
          { version: '2.7.0' },
        ],
        sourceUrl: 'https://github.com/pytest-dev/pytest',
      });
    });

    it('supports channel from prefix.dev with null response', async () => {
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .reply(200, { data: { package: { variants: null } } });

      const config = {
        packageName: 'pytest',
        registryUrls: ['https://prefix.dev/conda-forge'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
      });
      expect(res).toBe(null);
    });

    it('supports channel from prefix.dev with multiple page responses', async () => {
      // mock files
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .once()
        .reply(200, {
          data: {
            package: {
              variants: {
                pages: 2,
                page: [
                  {
                    version: '0.0.5',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:21Z',
                    ).toString(),
                    yankedReason: null,
                    urls: [{ url: 'https://dev/url', kind: 'DEV' }],
                  },
                  {
                    version: '0.0.5',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:20.840Z',
                    ).toString(),
                    yankedReason: null,
                    urls: [{ url: 'https://home/url', kind: 'HOME' }],
                  },
                  {
                    version: '0.0.5',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:23Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.56',
                    createdAt: null,
                    yankedReason: null,
                  },
                ],
              },
            },
          },
        });
      httpMock
        .scope('https://prefix.dev/api/graphql')
        .post('')
        .once()
        .reply(200, {
          data: {
            package: {
              variants: {
                pages: 2,
                page: [
                  {
                    version: '0.0.7',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:21Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.8',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:20.840Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.10',
                    createdAt: DateTime.fromISO(
                      '2020-02-29T01:40:23Z',
                    ).toString(),
                    yankedReason: null,
                  },
                  {
                    version: '0.0.560',
                    createdAt: null,
                    yankedReason: null,
                  },
                ],
              },
            },
          },
        });

      const config = {
        packageName: 'pytest',
        registryUrls: ['https://prefix.dev/conda-forge'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
      });
      expect(res).toMatchObject({
        registryUrl: 'https://prefix.dev/conda-forge',
        homepage: 'https://home/url',
        sourceUrl: 'https://dev/url',
        releases: [
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:21.000Z',
            version: '0.0.5',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:21.000Z',
            version: '0.0.7',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:20.840Z',
            version: '0.0.8',
          },
          {
            isDeprecated: false,
            releaseTimestamp: '2020-02-29T01:40:23.000Z',
            version: '0.0.10',
          },
          {
            isDeprecated: false,
            version: '0.0.56',
          },
          {
            isDeprecated: false,
            version: '0.0.560',
          },
        ],
      });
    });
  });

  describe('repodata.json channel', () => {
    const channelUrl = 'https://example.com/conda/linux-64';
    let repodataZst: Buffer;

    beforeAll(async () => {
      repodataZst = await zstdCompress(Buffer.from(repodataJson));
    });

    beforeEach(() => {
      memCache.init();
    });

    afterEach(() => {
      memCache.reset();
    });

    it('parses versions from a zstd-compressed repodata.json.zst', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(200, repodataZst);

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res).toEqual({
        registryUrl: channelUrl,
        releases: [
          { version: '3.13.0', releaseTimestamp: '2023-11-14T22:13:20.000Z' },
          { version: '3.14.5', releaseTimestamp: '2024-06-10T06:13:20.000Z' },
          { version: '3.15.0', releaseTimestamp: '2024-06-21T20:00:00.000Z' },
        ],
      });
    });

    it('falls back to plain repodata.json when no .zst is published', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(404)
        .get('/repodata.json')
        .reply(200, repodataJson);

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res?.releases).toHaveLength(3);
    });

    it('treats a registryUrl that is not a URL as a single subdir', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: ['not-a-url'],
      });

      expect(res).toBeNull();
    });

    it('returns null when the package is absent from repodata', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(200, repodataZst);

      const res = await getPkgReleases({
        datasource,
        packageName: 'does-not-exist',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res).toBeNull();
    });

    it('returns null when neither .zst nor .json exist', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(404)
        .get('/repodata.json')
        .reply(404);

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res).toBeNull();
    });

    it('throws for a 5xx repodata response', async () => {
      httpMock.scope(channelUrl).get('/repodata.json.zst').reply(502);

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'python',
          registryUrls: [`${channelUrl}/`],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('downloads the index once and reuses it across packages', async () => {
      const ds = new CondaDatasource();
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(200, repodataZst);

      const python = await ds.getReleases({
        packageName: 'python',
        registryUrl: `${channelUrl}/`,
      });
      const numpy = await ds.getReleases({
        packageName: 'numpy',
        registryUrl: `${channelUrl}/`,
      });

      expect(python?.releases).toHaveLength(3);
      expect(numpy?.releases).toEqual([{ version: '2.0.0' }]);
    });

    it('returns null when the index is not valid JSON', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(404)
        .get('/repodata.json')
        .reply(200, 'this is not repodata');

      // the parse error is not an `HttpError`, so it is rethrown for
      // `getPkgReleases` to swallow rather than wrapped in an
      // `ExternalHostError`
      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res).toBeNull();
    });

    it('falls back to plain repodata.json when the compressed variant is forbidden', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(403)
        .get('/repodata.json')
        .reply(200, repodataJson);

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res?.releases).toHaveLength(3);
    });

    it('falls back to plain repodata.json when the compressed variant is not zstd', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(200, repodataJson)
        .get('/repodata.json')
        .reply(200, repodataJson);

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res?.releases).toHaveLength(3);
    });

    it('does not ask for the plain index when the host is unreachable', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .replyWithError('nope');

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res).toBeNull();
    });

    it('rethrows a failure of the plain index', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(404)
        .get('/repodata.json')
        .reply(502);

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'python',
          registryUrls: [`${channelUrl}/`],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('warns for an index that contains no packages', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(404)
        .get('/repodata.json')
        .reply(200, '{}');

      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res).toBeNull();
      expect(logger.once.warn).toHaveBeenCalled();
    });

    it('retries the index for the next package after a failure', async () => {
      const ds = new CondaDatasource();
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(502)
        .get('/repodata.json.zst')
        .reply(200, repodataZst);

      await expect(
        ds.getReleases({
          packageName: 'python',
          registryUrl: `${channelUrl}/`,
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);

      const numpy = await ds.getReleases({
        packageName: 'numpy',
        registryUrl: `${channelUrl}/`,
      });

      expect(numpy?.releases).toEqual([{ version: '2.0.0' }]);
    });

    it('reports the earliest timestamp among the builds of a version', async () => {
      httpMock
        .scope(channelUrl)
        .get('/repodata.json.zst')
        .reply(200, repodataZst);

      const res = await getPkgReleases({
        datasource,
        packageName: 'scipy',
        registryUrls: [`${channelUrl}/`],
      });

      expect(res?.releases).toEqual([
        // the `.tar.bz2` build carries no timestamp, so the later `.conda`
        // build is the one that supplies it
        { version: '1.0.0', releaseTimestamp: '2024-06-10T06:13:20.000Z' },
        // the `.conda` build is older than the `.tar.bz2` build seen first
        { version: '1.1.0', releaseTimestamp: '2023-11-14T22:13:20.000Z' },
        // the `.conda` build carries no timestamp, so the earlier one stands
        { version: '1.2.0', releaseTimestamp: '2023-11-14T22:13:20.000Z' },
        // channels built by older conda versions record seconds, not millis
        { version: '1.3.0', releaseTimestamp: '2023-11-14T22:13:20.000Z' },
      ]);
    });

    describe('package cache', () => {
      afterEach(() => {
        GlobalConfig.reset();
      });

      it('does not write a standard channel to the package cache', async () => {
        const setCache = vi.spyOn(packageCache, 'setWithRawTtl');
        httpMock
          .scope(channelUrl)
          .get('/repodata.json.zst')
          .reply(200, repodataZst);

        const res = await getPkgReleases({
          datasource,
          packageName: 'python',
          registryUrls: [`${channelUrl}/`],
        });

        expect(res?.releases).toHaveLength(3);
        expect(setCache).not.toHaveBeenCalledWith(
          'datasource-conda',
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });

      it('still writes the Anaconda.org API to the package cache', async () => {
        const setCache = vi.spyOn(packageCache, 'setWithRawTtl');
        httpMock
          .scope(defaultRegistryUrl)
          .get(depUrl)
          .reply(200, Fixtures.get('pytest.json'));

        await getPkgReleases({ datasource, packageName });

        expect(setCache).toHaveBeenCalledWith(
          'datasource-conda',
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });

      it('writes a standard channel when cachePrivatePackages is set', async () => {
        GlobalConfig.set({ cachePrivatePackages: true });
        const setCache = vi.spyOn(packageCache, 'setWithRawTtl');
        httpMock
          .scope(channelUrl)
          .get('/repodata.json.zst')
          .reply(200, repodataZst);

        await getPkgReleases({
          datasource,
          packageName: 'python',
          registryUrls: [`${channelUrl}/`],
        });

        expect(setCache).toHaveBeenCalledWith(
          'datasource-conda',
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });
    });
  });
});
