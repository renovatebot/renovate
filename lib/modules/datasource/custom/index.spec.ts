import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { CustomDatasource } from './index';

describe('modules/datasource/custom/index', () => {
  describe('getReleases', () => {
    it('return null if only the prefix is supplied', async () => {
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.`,
        packageName: '*',
        customDatasources: {},
      });
      expect(result).toBeNull();
    });

    it('return null if no registryUrl is provided as well no defaultRegistryTemplate is defined', async () => {
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {},
        },
      });
      expect(result).toBeNull();
    });

    it('return null if no custom datasource could  be found', async () => {
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: '*',
        customDatasources: {},
      });
      expect(result).toBeNull();
    });

    it('return null on http error', async () => {
      httpMock.scope('https://example.com').get('/v1').reply(404);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'aPackageName',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toBeNull();
    });

    it('return null if schema validation fails', async () => {
      httpMock.scope('https://example.com').get('/v1').reply(200, {
        version: 'v1.0.0',
      });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toBeNull();
    });

    it('return releases for api directly exposing in renovate format', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, expected);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases for plain text API directly exposing in Renovate format', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };
      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, '1.0.0\n2.0.0\n3.0.0', {
          'Content-Type': 'text/plain',
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases for plain text API and trim the content', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
          {
            version: '3.0.0',
          },
        ],
      };
      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, '1.0.0 \n2.0.0 \n 3.0.0 ', {
          'Content-Type': 'text/plain',
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases for plain text API when only returns a single version', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, '1.0.0', {
        'Content-Type': 'text/plain',
      });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return null for plain text API if the body is not what is expected', async () => {
      const expected = {
        releases: [
          {
            version: '1.0.0',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, expected, {
        'Content-Type': 'application/json',
      });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'plain',
          },
        },
      });
      expect(result).toBeNull();
    });

    it('return release when templating registryUrl', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };
      httpMock
        .scope('https://example.com')
        .get('/v1/myPackage')
        .reply(200, expected);
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate:
              'https://example.com/v1/{{packageName}}',
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return release with templated path', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };

      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, {
          myPackage: expected,
          otherPackage: {
            releases: [
              {
                version: 'v2.0.0',
              },
            ],
          },
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            transformTemplates: ['{{packageName}}'],
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return release with templated path with multiple layers', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
          },
        ],
      };

      httpMock
        .scope('https://example.com')
        .get('/v1')
        .reply(200, {
          groupName: {
            myPackage: expected,
            otherPackage: {
              releases: [
                {
                  version: 'v2.0.0',
                },
              ],
            },
          },
        });
      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            transformTemplates: ['groupName.{{packageName}}'],
          },
        },
      });
      expect(result).toEqual(expected);
    });

    it('return releases from HTML links', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
            sourceUrl: 'https://example.com/package-1.0.tar.gz',
          },
        ],
      };

      httpMock
        .scope('https://example.com')
        .get('/index.html')
        .reply(200, Fixtures.get('simple.html'), {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/index.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });


    it('return releases from HTML links on curl download page', async () => {
      httpMock
        .scope('https://curl.se')
        .get('/download.html')
        .reply(200, Fixtures.get('curl-download.html'), {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://curl.se/download.html',
            format: 'html',
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('return releases from nginx directory listing', async () => {
      httpMock
        .scope('http://nginx.org')
        .get('/download/')
        .reply(200, Fixtures.get('nginx-downloads.html'), {
          'Content-Type': 'text/html',
        })
        .get('/download')
        .reply(301, undefined, {
            'Location': 'http://nginx.org/download/'
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'http://nginx.org/download',
            format: 'html',
          },
        },
      });

      expect(result).toMatchSnapshot();
    });
  });
});
