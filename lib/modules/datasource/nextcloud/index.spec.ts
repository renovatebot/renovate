import { getPkgReleases } from '..';
import { NextcloudDatasource } from '.';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/nextcloud/index', () => {
  it('no registryUrl', async () => {
    const res = await getPkgReleases({
      datasource: NextcloudDatasource.id,
      packageName: 'user_oidc',
      registryUrls: [],
    });

    expect(res).toBeNull();
  });

  it('no package', async () => {
    const data = '[]';

    httpMock.scope('https://custom.registry.com').get('/').reply(200, data);

    const res = await getPkgReleases({
      datasource: NextcloudDatasource.id,
      packageName: 'user_oidc',
      registryUrls: ['https://custom.registry.com'],
    });

    expect(res).toBeNull();
  });

  it('package with no versions', async () => {
    const data = `
      [
        {
          "id": "user_oidc",
          "website": "https://github.com/nextcloud/user_oidc",
          "created": "2020-05-25T10:51:12.430005Z",
          "releases": []
        }
      ]
    `;

    httpMock.scope('https://custom.registry.com').get('/').reply(200, data);

    const res = await getPkgReleases({
      datasource: NextcloudDatasource.id,
      packageName: 'user_oidc',
      registryUrls: ['https://custom.registry.com'],
    });

    expect(res?.sourceUrl).toBe('https://github.com/nextcloud/user_oidc');
    expect(res?.registryUrl).toBe('https://custom.registry.com');

    expect(res?.releases).toBeEmpty();
  });

  it.each([
    {
      website: 'https://github.com/nextcloud/user_oidc',
      changelogUrl: 'https://github.com/nextcloud-releases/user_oidc',
    },
    {
      website: 'https://custom.app',
      changelogUrl: 'https://custom.app',
    },
  ])(
    'package with website %s returns %s',
    async ({ website, changelogUrl }) => {
      const data = `
      [
        {
          "id": "user_oidc",
          "website": "${website}",
          "created": "2020-05-25T10:51:12.430005Z",
          "releases": [
            {
              "version": "7.3.0",
              "created": "2025-07-25T09:41:26.318411Z",
              "isNightly": false,
              "translations": {
                "en": {
                  "changelog": "testChangelog"
                }
              }
            }
          ]
        }
      ]
    `;

      httpMock.scope('https://custom.registry.com').get('/').reply(200, data);

      const res = await getPkgReleases({
        datasource: NextcloudDatasource.id,
        packageName: 'user_oidc',
        registryUrls: ['https://custom.registry.com'],
      });

      expect(res?.changelogUrl).toBe(changelogUrl);
    },
  );

  it('package with changelog content and url', async () => {
    const data = `
      [
        {
          "id": "user_oidc",
          "website": "https://github.com/nextcloud/user_oidc",
          "created": "2020-05-25T10:51:12.430005Z",
          "releases": [
            {
              "version": "7.3.0",
              "created": "2025-07-25T09:41:26.318411Z",
              "isNightly": false,
              "translations": {
                "en": {
                  "changelog": "testChangelog"
                }
              }
            },
            {
              "version": "7.2.0",
              "created": "2025-04-24T09:24:43.232337Z",
              "isNightly": true,
              "translations": {
                "en": {
                  "changelog": ""
                }
              }
            },
            {
              "version": "7.1.0",
              "created": "2025-01-14T09:13:25.123456Z",
              "isNightly": false,
              "translations": {
              }
            }
          ]
        }
      ]
    `;

    httpMock.scope('https://custom.registry.com').get('/').reply(200, data);

    const res = await getPkgReleases({
      datasource: NextcloudDatasource.id,
      packageName: 'user_oidc',
      registryUrls: ['https://custom.registry.com'],
    });

    expect(res).toStrictEqual({
      changelogUrl: 'https://github.com/nextcloud-releases/user_oidc',
      registryUrl: 'https://custom.registry.com',
      releases: [
        {
          changelogContent: undefined,
          isStable: true,
          releaseTimestamp: '2025-01-14T09:13:25.123Z',
          version: '7.1.0',
        },
        {
          changelogContent: undefined,
          isStable: false,
          releaseTimestamp: '2025-04-24T09:24:43.232Z',
          version: '7.2.0',
        },
        {
          changelogContent: 'testChangelog',
          isStable: true,
          releaseTimestamp: '2025-07-25T09:41:26.318Z',
          version: '7.3.0',
        },
      ],
      sourceUrl: 'https://github.com/nextcloud/user_oidc',
    });
  });
});
