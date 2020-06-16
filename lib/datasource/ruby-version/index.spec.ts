import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import { getReleases } from '.';

const rubyReleasesHtml = fs.readFileSync(
  'lib/datasource/ruby-version/__fixtures__/releases.html',
  'utf8'
);

describe('datasource/gradle', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('parses real data', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, rubyReleasesHtml);
      const res = await getReleases();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for empty result', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, {});
      await expect(getReleases()).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws for 404', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(404);
      await expect(getReleases()).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
