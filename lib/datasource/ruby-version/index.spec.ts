import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';
import { id as datasource } from '.';

const rubyReleasesHtml = loadFixture('releases.html');

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
    it('throws for empty result', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, {});
      await expect(
        getPkgReleases({ datasource, depName: 'ruby' })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws for 404', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(404);
      await expect(
        getPkgReleases({ datasource, depName: 'ruby' })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
