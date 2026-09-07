import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getPkgReleases } from '../index.ts';
import { GolangVersionDatasource } from './index.ts';

const golangReleasesContent = Fixtures.get('releases.go');
const golangReleasesInvalidContent = Fixtures.get('releases-invalid.go');
const golangReleasesInvalidContent2 = Fixtures.get('releases-invalid2.go');
const golangReleasesInvalidContent3 = Fixtures.get('releases-invalid3.go');
const golangReleasesInvalidContent4 = Fixtures.get('releases-invalid4.go');
const golangReleasesInvalidContent5 = Fixtures.get('releases-invalid5.go');
const golangReleasesInvalidContent6 = Fixtures.get('releases-invalid6.go');

const datasource = GolangVersionDatasource.id;

describe('modules/datasource/golang-version/index', () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesContent);
      const res = await getPkgReleases({
        datasource,
        packageName: 'golang',
      });
      expect(res).toEqual({
        homepage: 'https://go.dev/',
        registryUrl: 'https://raw.githubusercontent.com/golang/website',
        sourceUrl: 'https://github.com/golang/go',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2012-03-28T00:00:00.000Z' },
          { version: '1.8.0', releaseTimestamp: '2017-02-16T00:00:00.000Z' },
          { version: '1.9.0', releaseTimestamp: '2017-08-24T00:00:00.000Z' },
          { version: '1.9.1', releaseTimestamp: '2017-10-04T00:00:00.000Z' },
          { version: '1.12.13', releaseTimestamp: '2019-10-31T00:00:00.000Z' },
          { version: '1.17.8', releaseTimestamp: '2022-03-03T00:00:00.000Z' },
          { version: '1.18.0', releaseTimestamp: '2022-03-15T00:00:00.000Z' },
        ],
      });
    });

    it('supports custom registry URL', async () => {
      httpMock
        .scope('https://custom-registry/website')
        .get('/HEAD/internal/history/release.go')
        .reply(200, golangReleasesContent);
      const config = {
        registryUrls: ['https://custom-registry/website'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        packageName: 'golang',
      });
      expect(res?.releases).toHaveLength(7);
      expect(res?.releases[0]).toEqual({
        releaseTimestamp: '2012-03-28T00:00:00.000Z',
        version: '1.0.0',
      });
    });

    it('throws ExternalHostError for invalid release with no versions', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'golang',
        }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('throws ExternalHostError for invalid release with wrong termination', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent2);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'golang',
        }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('throws ExternalHostError for empty result', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, {});
      await expect(
        getPkgReleases({ datasource, packageName: 'golang' }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('throws ExternalHostError for zero releases extracted', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent3);
      await expect(
        getPkgReleases({ datasource, packageName: 'golang' }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('throws ExternalHostError for invalid release semver', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent4);
      await expect(
        getPkgReleases({ datasource, packageName: 'golang' }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('returns null for error 404', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(404);
      await expect(
        getPkgReleases({ datasource, packageName: 'golang' }),
      ).resolves.toBeNull();
    });

    it('throws ExternalHostError for invalid release format beginning', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent5);
      await expect(
        getPkgReleases({ datasource, packageName: 'golang' }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('throws ExternalHostError for invalid release format', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent6);
      await expect(
        getPkgReleases({ datasource, packageName: 'golang' }),
      ).rejects.toThrow(ExternalHostError);
    });
  });
});
