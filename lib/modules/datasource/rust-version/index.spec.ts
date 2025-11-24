import { getPkgReleases } from '..';
import { RustVersionDatasource } from '.';
import * as httpMock from '~test/http-mock';

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

    it('transforms nightly versions correctly', async () => {
      const manifestsContent = `static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml
static.rust-lang.org/dist/2025-11-23/channel-rust-nightly.toml`;

      httpMock
        .scope('https://static.rust-lang.org')
        .get('/manifests.txt')
        .reply(200, manifestsContent);

      const res = await getPkgReleases({
        datasource,
        packageName: 'rust',
      });

      expect(res?.releases).toEqual(
        expect.arrayContaining([
          {
            version: 'nightly-2025-11-24',
            releaseTimestamp: '2025-11-24T00:00:00.000Z',
          },
          {
            version: 'nightly-2025-11-23',
            releaseTimestamp: '2025-11-23T00:00:00.000Z',
          },
        ]),
      );
      expect(res?.releases).toHaveLength(2);
    });

    it('filters out stable and beta channel entries', async () => {
      const manifestsContent = `static.rust-lang.org/dist/2025-11-24/channel-rust-stable.toml
static.rust-lang.org/dist/2025-11-24/channel-rust-beta.toml
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
