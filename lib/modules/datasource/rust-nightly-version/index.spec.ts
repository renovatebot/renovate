import type { GetPkgReleasesConfig, GetReleasesConfig } from '..';
import { getPkgReleases } from '..';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { RustNightlyVersionDatasource } from '.';
import * as httpMock from '~test/http-mock';
import { partial } from '~test/util';

const registryUrl = 'https://rust-lang.github.io/rustup-components-history/';
const datasource = RustNightlyVersionDatasource.id;

let config: GetPkgReleasesConfig;

describe('modules/datasource/rust-nightly-version/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      config = {
        datasource,
        packageName: 'rust',
      };
    });

    it('returns releases for successful API call', async () => {
      httpMock
        .scope(registryUrl)
        .get('/x86_64-unknown-linux-gnu/rust.json')
        .reply(200, {
          '2025-10-06': true,
          '2025-10-07': true,
          '2025-10-08': false,
          '2025-10-09': true,
          '2025-10-10': true,
          '2025-10-11': true,
          '2025-10-12': true,
          last_available: '2025-10-12',
        });

      const res = await getPkgReleases(config);

      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(6);
      expect(res?.releases).toEqual([
        {
          version: 'nightly-2025-10-06',
          releaseTimestamp: '2025-10-06T00:00:00.000Z',
        },
        {
          version: 'nightly-2025-10-07',
          releaseTimestamp: '2025-10-07T00:00:00.000Z',
        },
        {
          version: 'nightly-2025-10-09',
          releaseTimestamp: '2025-10-09T00:00:00.000Z',
        },
        {
          version: 'nightly-2025-10-10',
          releaseTimestamp: '2025-10-10T00:00:00.000Z',
        },
        {
          version: 'nightly-2025-10-11',
          releaseTimestamp: '2025-10-11T00:00:00.000Z',
        },
        {
          version: 'nightly-2025-10-12',
          releaseTimestamp: '2025-10-12T00:00:00.000Z',
        },
      ]);
      expect(res?.sourceUrl).toBe('https://github.com/rust-lang/rust');
    });

    it('supports other package names', async () => {
      httpMock
        .scope(registryUrl)
        .get('/x86_64-unknown-linux-gnu/cargo.json')
        .reply(200, {
          '2025-10-06': true,
          last_available: '2025-10-06',
        });

      const res = await getPkgReleases({ ...config, packageName: 'cargo' });

      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases).toEqual([
        {
          version: 'nightly-2025-10-06',
          releaseTimestamp: '2025-10-06T00:00:00.000Z',
        },
      ]);
      expect(res?.sourceUrl).toBe('https://github.com/rust-lang/rust');
    });

    it('supports non-default targets', async () => {
      httpMock
        .scope(registryUrl)
        .get('/aarch64-apple-darwin/rust.json')
        .reply(200, {
          '2025-11-14': true,
          last_available: '2025-11-14',
        });

      const res = await getPkgReleases({
        ...config,
        packageName: 'rust?target=aarch64-apple-darwin',
      });

      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases).toEqual([
        {
          version: 'nightly-2025-11-14',
          releaseTimestamp: '2025-11-14T00:00:00.000Z',
        },
      ]);
      expect(res?.sourceUrl).toBe('https://github.com/rust-lang/rust');
    });

    it('returns null on 404', async () => {
      httpMock
        .scope(registryUrl)
        .get('/x86_64-unknown-linux-gnu/rust.json')
        .reply(404);

      const res = await getPkgReleases(config);

      expect(res).toBeNull();
    });

    it('handles empty releases', async () => {
      httpMock
        .scope(registryUrl)
        .get('/x86_64-unknown-linux-gnu/rust.json')
        .reply(200, {
          last_available: '2025-10-12',
        });

      const res = await getPkgReleases(config);

      expect(res).toBeNull();
    });

    it('throws on HTTP errors', async () => {
      httpMock
        .scope(registryUrl)
        .get('/x86_64-unknown-linux-gnu/rust.json')
        .reply(500);

      const rustNightlyVersionDatasource = new RustNightlyVersionDatasource();

      await expect(
        rustNightlyVersionDatasource.getReleases(
          partial<GetReleasesConfig>({
            registryUrl,
            packageName: 'rust',
          }),
        ),
      ).rejects.toThrow(ExternalHostError);
    });
  });
});
