import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { RubyVersionDatasource } from '.';

const datasource = RubyVersionDatasource.id;

describe('modules/datasource/ruby-version/index', () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, Fixtures.get('releases.html'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'ruby',
      });
      expect(res).toMatchSnapshot();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, {});
      const res = await getPkgReleases({
        datasource,
        packageName: 'ruby',
      });
      expect(res).toBeNull();
    });

    it('throws for 404', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(404);
      await expect(
        getPkgReleases({ datasource, packageName: 'ruby' }),
      ).rejects.toThrow();
    });
  });
});
