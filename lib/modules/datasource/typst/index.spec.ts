import { DateTime } from 'luxon';
import { type DirectoryResult, dir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { getPkgReleases } from '../index.ts';
import { TypstDatasource } from './index.ts';

describe('modules/datasource/typst/index', () => {
  describe('public cache boundary', () => {
    let cacheDir: DirectoryResult;

    beforeEach(async () => {
      cacheDir = await dir({ unsafeCleanup: true });
      GlobalConfig.set({ cachePrivatePackages: false });
      memCache.init();
      await packageCache.init({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await packageCache.cleanup({});
      memCache.reset();
      GlobalConfig.reset();
      await cacheDir.cleanup();
    });

    it.each`
      packageName                  | cachePrivatePackages | ageMinutes
      ${'local/internal-template'} | ${false}             | ${0}
      ${'local/internal-template'} | ${true}              | ${60}
      ${'private/internal-tool'}   | ${false}             | ${60}
    `(
      'rejects $packageName before cache access',
      async ({ packageName, cachePrivatePackages, ageMinutes }) => {
        GlobalConfig.set({ cachePrivatePackages });
        await packageCache.setWithRawTtl(
          'datasource-typst:registry-releases',
          `cache-decorator:${packageName}`,
          {
            cachedAt: DateTime.now().minus({ minutes: ageMinutes }).toISO(),
            value: { releases: [{ version: '1.0.0' }] },
          },
          120,
        );
        const getCache = vi.spyOn(packageCache, 'get');
        const setCache = vi.spyOn(packageCache, 'setWithRawTtl');

        const result = await new TypstDatasource().getReleases({ packageName });

        expect(result).toBeNull();
        expect(getCache).not.toHaveBeenCalled();
        expect(setCache).not.toHaveBeenCalled();
      },
    );

    it('reuses public releases despite a configured private registry', async () => {
      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(
          200,
          [
            {
              name: 'public-package',
              version: '1.0.0',
              repository: 'https://github.com/example/public',
              updatedAt: 1704708827,
            },
          ],
          { 'Cache-Control': 'must-revalidate, max-age=600' },
        );
      const datasource = new TypstDatasource();
      const config = {
        packageName: 'preview/public-package',
        registryUrl: 'https://private.example/index.json',
      };
      const expected = {
        sourceUrl: 'https://github.com/example/public',
        registryUrl: 'https://packages.typst.org/preview/index.json',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2024-01-08T10:13:47.000Z' },
        ],
      };

      const first = await datasource.getReleases(config);
      memCache.reset();
      const second = await datasource.getReleases(config);

      expect(first).toEqual(expected);
      expect(second).toEqual(expected);
      await expect(
        packageCache.get(
          'datasource-typst:cache-provider',
          'https://packages.typst.org/preview/index.json',
        ),
      ).resolves.toBeDefined();
    });

    it('ignores custom registry URLs in generic lookups', async () => {
      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, []);

      const result = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName: 'preview/missing',
        registryUrls: ['https://private.example/index.json'],
      });

      expect(result).toBeNull();
    });
  });

  describe('getReleases', () => {
    it('processes real data', async () => {
      const packageName = 'preview/example-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, [
          {
            name: 'example-package',
            version: '0.1.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author One <author@example.com>'],
            license: 'MIT',
            description: 'An example package',
            repository: 'https://github.com/example/repo',
            keywords: ['example'],
            updatedAt: 1704708827,
          },
          {
            name: 'example-package',
            version: '0.2.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author One <author@example.com>'],
            license: 'MIT',
            description: 'An example package',
            repository: 'https://github.com/example/repo',
            keywords: ['example'],
            updatedAt: 1704808827,
          },
          {
            name: 'example-package',
            version: '1.0.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author One <author@example.com>'],
            license: 'MIT',
            description: 'An example package',
            repository: 'https://github.com/example/repo',
            keywords: ['example'],
            updatedAt: 1704908827,
          },
        ]);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        registryUrl: 'https://packages.typst.org/preview/index.json',
        sourceUrl: 'https://github.com/example/repo',
        releases: [
          {
            version: '0.1.0',
            releaseTimestamp: '2024-01-08T10:13:47.000Z',
          },
          {
            version: '0.2.0',
            releaseTimestamp: '2024-01-09T14:00:27.000Z',
          },
          {
            version: '1.0.0',
            releaseTimestamp: '2024-01-10T17:47:07.000Z',
          },
        ],
      });
    });

    it('returns null for unsupported namespace', async () => {
      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName: 'unsupported/example-package',
      });

      expect(res).toBeNull();
    });

    it('returns null when package not found in registry', async () => {
      const packageName = 'preview/nonexistent-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, [
          {
            name: 'other-package',
            version: '1.0.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author <author@example.com>'],
            license: 'MIT',
            description: 'Another package',
            repository: 'https://github.com/example/other',
            keywords: ['other'],
            updatedAt: 1704708827,
          },
        ]);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });

    it('handles multiple versions of the same package', async () => {
      const packageName = 'preview/multi-version';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, [
          {
            name: 'multi-version',
            version: '0.1.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author <author@example.com>'],
            license: 'MIT',
            description: 'A package with multiple versions',
            repository: 'https://github.com/example/multi',
            keywords: ['multi'],
            updatedAt: 1704708827,
          },
          {
            name: 'multi-version',
            version: '0.2.0',
            entrypoint: 'src/lib.typ',
            authors: ['Author <author@example.com>'],
            license: 'MIT',
            description: 'A package with multiple versions',
            repository: 'https://github.com/example/multi',
            keywords: ['multi'],
            updatedAt: 1704808827,
          },
        ]);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toEqual({
        registryUrl: 'https://packages.typst.org/preview/index.json',
        sourceUrl: 'https://github.com/example/multi',
        releases: [
          {
            version: '0.1.0',
            releaseTimestamp: '2024-01-08T10:13:47.000Z',
          },
          {
            version: '0.2.0',
            releaseTimestamp: '2024-01-09T14:00:27.000Z',
          },
        ],
      });
    });

    it('handles registry fetch errors', async () => {
      const packageName = 'preview/error-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(500);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });

    it('handles empty registry response', async () => {
      const packageName = 'preview/empty-package';

      httpMock
        .scope('https://packages.typst.org')
        .get('/preview/index.json')
        .reply(200, []);

      const res = await getPkgReleases({
        datasource: TypstDatasource.id,
        packageName,
      });

      expect(res).toBeNull();
    });
  });
});
