import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { GolangVersionDatasource } from '.';

const golangReleasesContent = loadFixture('releases.go');

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

    it('throws for empty result', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(200, {});
      await expect(
        getPkgReleases({ datasource, depName: 'golang' })
      ).rejects.toThrow();
    });

    it('throws for 404', async () => {
      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/master/internal/history/release.go')
        .reply(404);
      await expect(
        getPkgReleases({ datasource, depName: 'golang' })
      ).rejects.toThrow();
    });
  });
});
