import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { HtmlLinksDatasource } from '.';

const datasource = HtmlLinksDatasource.id;

describe('modules/datasource/html-links/index', () => {
  describe('getReleases', () => {
    it('parses simple page', async () => {
      httpMock
        .scope('https://website.com')
        .get('/')
        .reply(200, Fixtures.get('simple.html'));
      const res = await getPkgReleases({
        registryUrls: ['https://website.com'],
        datasource,
        packageName: 'package-(.*)\\.tar\\.gz$',
      });
      expect(res).toMatchSnapshot();
    });

    it('parses Curl downloads page', async () => {
      httpMock
        .scope('https://curl.se')
        .get('/download/')
        .reply(200, Fixtures.get('curl-downloads.html'))
        .get('/download')
        .reply(301, undefined, {
            'Location': 'https://curl.se/download/'
        });
      const res = await getPkgReleases({
        registryUrls: ['https://curl.se/download'],
        datasource,
        packageName: 'curl-(.*)\\.tar\\.xz$',
      });
      expect(res).toMatchSnapshot();
    });

    it('parses nginx directory listing', async () => {
      httpMock
        .scope('http://nginx.org')
        .get('/download/')
        .reply(200, Fixtures.get('nginx-downloads.html'))
        .get('/download')
        .reply(301, undefined, {
            'Location': 'http://nginx.org/download/'
        });
      const res = await getPkgReleases({
        registryUrls: ['http://nginx.org/download'],
        datasource,
        packageName: 'nginx-(.*)\\.tar\\.gz$',
      });
      expect(res).toMatchSnapshot();
    });
  });
});
