import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';
import { RubyVersionDatasource } from '.';

const rubyReleasesHtml = loadFixture('releases.html');

const datasource = RubyVersionDatasource.id;

describe(getName(), () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, rubyReleasesHtml);
      const res = await getPkgReleases({
        datasource,
        depName: 'ruby',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null empty result', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, {});
      expect(await getPkgReleases({ datasource, depName: 'ruby' })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(404);
      expect(await getPkgReleases({ datasource, depName: 'ruby' })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
