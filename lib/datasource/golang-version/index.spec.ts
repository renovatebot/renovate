import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { GolangVersionDatasource } from '.';

const golangReleasesContent = loadFixture('releases.go');
const golangReleasesInvalidContent = loadFixture('releases-invalid.go');
const golangReleasesInvalidContent2 = loadFixture('releases-invalid2.go');
const golangReleasesInvalidContent3 = loadFixture('releases-invalid3.go');

const datasource = GolangVersionDatasource.id;

describe('datasource/golang-version/index', () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(200, golangReleasesContent);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang',
      });
      expect(res).toMatchSnapshot();
    });

    it('returns null for invalid release with no versions', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang',
      });
      expect(res).toBeNull();
    });

    it('returns null for invalid release with wrong termination', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent2);
      const res = await getPkgReleases({
        datasource,
        depName: 'golang',
      });
      expect(res).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(200, {});
      expect(
        await getPkgReleases({ datasource, depName: 'golang' })
      ).toBeNull();
    });

    it('throws ExternalHostError for zero releases extracted', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(200, golangReleasesInvalidContent3);
      await expect(
        getPkgReleases({ datasource, depName: 'golang' })
      ).rejects.toThrow(ExternalHostError);
    });

    it('returns null for error 404', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(404);
      expect(
        await getPkgReleases({ datasource, depName: 'golang' })
      ).toBeNull();
    });
  });
});
