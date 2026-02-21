import * as httpMock from '~test/http-mock.ts';
import { getPkgReleases } from '../index.ts';
import { RustVersionDatasource } from './index.ts';

const datasource = RustVersionDatasource.id;

describe('modules/datasource/rust-version/index', () => {
  describe('getReleases', () => {
    it('fetches and parses manifest data', async () => {
      const manifestsContent = `static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml
static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml
static.rust-lang.org/dist/2025-01-15/channel-rust-1.83.0-beta.5.toml
static.rust-lang.org/dist/2025-11-24/channel-rust-stable.toml
static.rust-lang.org/dist/2025-11-24/channel-rust-beta.toml`;

      httpMock
        .scope('https://static.rust-lang.org')
        .get('/manifests.txt')
        .reply(200, manifestsContent);

      const res = await getPkgReleases({
        datasource,
        packageName: 'rust',
      });

      expect(res).toMatchObject({
        releases: expect.arrayContaining([
          {
            version: 'nightly-2025-11-24',
            releaseTimestamp: '2025-11-24T00:00:00.000Z',
          },
          {
            version: '1.82.0',
            releaseTimestamp: '2024-10-17T00:00:00.000Z',
          },
          {
            version: '1.83.0-beta.5',
            releaseTimestamp: '2025-01-15T00:00:00.000Z',
          },
        ]),
        sourceUrl: 'https://github.com/rust-lang/rust',
      });
      expect(res?.releases).toHaveLength(3);
    });

    it('deduplicates versions with latest date', async () => {
      const manifestsContent = `static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml
static.rust-lang.org/dist/2024-10-18/channel-rust-1.82.0.toml
static.rust-lang.org/dist/2024-10-19/channel-rust-1.82.0.toml`;

      httpMock
        .scope('https://static.rust-lang.org')
        .get('/manifests.txt')
        .reply(200, manifestsContent);

      const res = await getPkgReleases({
        datasource,
        packageName: 'rust',
      });

      expect(res?.releases).toEqual([
        {
          version: '1.82.0',
          releaseTimestamp: '2024-10-19T00:00:00.000Z',
        },
      ]);
    });

    it('ignores unexpected URLs', async () => {
      const manifestsContent = `static.rust-lang.org/dist/invalid.toml
static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml`;

      httpMock
        .scope('https://static.rust-lang.org')
        .get('/manifests.txt')
        .reply(200, manifestsContent);

      const res = await getPkgReleases({
        datasource,
        packageName: 'rust',
      });

      expect(res?.releases).toEqual([
        {
          version: '1.82.0',
          releaseTimestamp: '2024-10-17T00:00:00.000Z',
        },
      ]);
    });

    it('supports custom registry URLs', async () => {
      const baseUrl = 'https://custom.url.com';
      const manifestsContent = `static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml`;

      httpMock
        .scope(baseUrl)
        .get('/manifests.txt')
        .reply(200, manifestsContent);

      const res = await getPkgReleases({
        datasource,
        packageName: 'rust',
        registryUrls: [baseUrl],
      });

      expect(res?.releases).toEqual([
        {
          version: '1.82.0',
          releaseTimestamp: '2024-10-17T00:00:00.000Z',
        },
      ]);
    });

    it('throws for network error', async () => {
      httpMock
        .scope('https://static.rust-lang.org')
        .get('/manifests.txt')
        .reply(500);

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'rust',
        }),
      ).rejects.toThrow();
    });
  });
});
