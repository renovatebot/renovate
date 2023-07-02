import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { CustomDatasource } from './index';

describe('modules/datasource/custom/index', () => {
  describe('getReleases', () => {
    it('return null if no custom datasource could not be found', async () => {
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
            registryUrlTemplate: 'https://example.com/v1',
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
            registryUrlTemplate: 'https://example.com/v1',
          },
        },
      });
      expect(result).toEqual(expected);
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
            registryUrlTemplate: 'https://example.com/v1/{{packageName}}',
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
            registryUrlTemplate: 'https://example.com/v1',
            pathTemplate: '{{packageName}}',
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
            registryUrlTemplate: 'https://example.com/v1',
            pathTemplate: 'groupName.{{packageName}}',
          },
        },
      });
      expect(result).toEqual(expected);
    });
  });
});
