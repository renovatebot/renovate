import { codeBlock, html } from 'common-tags';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { fs } from '../../../../test/util';
import { CustomDatasource } from './index';

jest.mock('../../../util/fs');

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

    it('return releases with digests for api directly exposing in renovate format', async () => {
      const expected = {
        releases: [
          {
            version: 'v1.0.0',
            newDigest: '0123456789abcdef',
          },
        ],
      };
      const content = {
        releases: [
          {
            version: 'v1.0.0',
            digest: '0123456789abcdef',
          },
        ],
      };
      httpMock.scope('https://example.com').get('/v1').reply(200, content);
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

    it('return releases for yaml API directly exposing in Renovate format', async () => {
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

      const yaml = codeBlock`
        releases:
          - version: 1.0.0
          - version: 2.0.0
          - version: 3.0.0
      `;

      httpMock.scope('https://example.com').get('/v1').reply(200, yaml, {
        'Content-Type': 'text/yaml',
      });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/v1',
            format: 'yaml',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for yaml file directly exposing in Renovate format', async () => {
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

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        releases:
          - version: 1.0.0
          - version: 2.0.0
          - version: 3.0.0
      `);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.yaml',
            format: 'yaml',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for json file directly exposing in Renovate format', async () => {
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

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`{
        "releases": [
          { "version": "1.0.0" },
          { "version": "2.0.0" },
          { "version": "3.0.0" }
        ]
      }`);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.json',
            format: 'json',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for json file after transformation', async () => {
      const expected = {
        "releases": [
          {
            "version": "3.6",
            "isDeprecated": true
          },
          {
            "version": "3.7",
            "isDeprecated": true
          },
          {
            "version": "3.8"
          },
          {
            "version": "3.5"
          },
          {
            "version": "3.10"
          },
          {
            "version": "3.11"
          },
          {
            "version": "3.12"
          },
        ]
      };

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`{"value":[{"id":null,"name":"dotnet","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":".NET","value":"dotnet","preferredOs":"windows","majorVersions":[{"displayText":".NET 8 (LTS)","value":"dotnet8","minorVersions":[{"displayText":".NET 8 (LTS)","value":"8","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|8.0","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8.x"},"supportedFeatures":{"disableSsh":true}}}}]},{"displayText":".NET 7 (STS)","value":"dotnet7","minorVersions":[{"displayText":".NET 7 (STS)","value":"7","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|7.0","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"7.x"},"supportedFeatures":{"disableSsh":true}}}}]},{"displayText":".NET 6","value":"dotnet6","minorVersions":[{"displayText":".NET 6 (LTS)","value":"6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|6.0","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"6.0.x"},"supportedFeatures":{"disableSsh":true}}}}]},{"displayText":".NET 5","value":"dotnet5","minorVersions":[{"displayText":".NET 5","value":"5","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|5.0","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"5.0.x"},"endOfLifeDate":"2022-05-08T00:00:00Z"}}}]},{"displayText":".NET Core 3","value":"dotnetcore3","minorVersions":[{"displayText":".NET Core 3.1 (LTS)","value":"3.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|3.1","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.1.301"},"isDeprecated":true,"endOfLifeDate":"2022-12-03T00:00:00Z"}}},{"displayText":".NET Core 3.0","value":"3.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|3.0","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.0.103"},"endOfLifeDate":"2020-03-03T00:00:00Z"}}}]},{"displayText":".NET Core 2","value":"dotnetcore2","minorVersions":[{"displayText":".NET Core 2.2","value":"2.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|2.2","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"2.2.207"},"endOfLifeDate":"2019-12-23T00:00:00Z"}}},{"displayText":".NET Core 2.1 (LTS)","value":"2.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|2.1","remoteDebuggingSupported":false,"isDeprecated":true,"appInsightsSettings":{"isSupported":false,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"2.1.807"},"endOfLifeDate":"2021-07-21T00:00:00Z"}}},{"displayText":".NET Core 2.0","value":"2.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|2.0","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"2.1.202"},"endOfLifeDate":"2018-10-01T00:00:00Z"}}}]},{"displayText":".NET Core 1","value":"dotnetcore1","minorVersions":[{"displayText":".NET Core 1.1","value":"1.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|1.1","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"1.1.14"},"endOfLifeDate":"2019-06-27T00:00:00Z"}}},{"displayText":".NET Core 1.0","value":"1.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"DOTNETCORE|1.0","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"1.1.14"},"endOfLifeDate":"2019-06-27T00:00:00Z"}}}]}]}},{"id":null,"name":"node","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"Node","value":"node","preferredOs":"linux","majorVersions":[{"displayText":"Node LTS","value":"lts","minorVersions":[{"displayText":"Node LTS","value":"lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|lts","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true}}}}]},{"displayText":"Node 20","value":"20","minorVersions":[{"displayText":"Node 20 LTS","value":"20-lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|20-lts","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"20.x"},"supportedFeatures":{"disableSsh":true}}}}]},{"displayText":"Node 18","value":"18","minorVersions":[{"displayText":"Node 18 LTS","value":"18-lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|18-lts","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"18.x"},"supportedFeatures":{"disableSsh":true}}}}]},{"displayText":"Node 16","value":"16","minorVersions":[{"displayText":"Node 16 LTS","value":"16-lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|16-lts","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"16.x"},"supportedFeatures":{"disableSsh":true},"endOfLifeDate":"2023-09-11T00:00:00Z"}}}]},{"displayText":"Node 14","value":"14","minorVersions":[{"displayText":"Node 14 LTS","value":"14-lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|14-lts","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"14.x"},"supportedFeatures":{"disableSsh":true},"endOfLifeDate":"2023-04-30T00:00:00Z"}}}]},{"displayText":"Node 12","value":"12","minorVersions":[{"displayText":"Node 12 LTS","value":"12-lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|12-lts","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"12.x"},"endOfLifeDate":"2022-04-01T00:00:00Z"}}},{"displayText":"Node 12.9","value":"12.9","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|12.9","isDeprecated":true,"remoteDebuggingSupported":true,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"12.x"},"endOfLifeDate":"2022-04-01T00:00:00Z"}}}]},{"displayText":"Node 10","value":"10","minorVersions":[{"displayText":"Node 10 LTS","value":"10-LTS","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10-lts","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}},{"displayText":"Node 10.16","value":"10.16","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10.16","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}},{"displayText":"Node 10.14","value":"10.14","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10.14","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}},{"displayText":"Node 10.12","value":"10.12","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10.12","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}},{"displayText":"Node 10.10","value":"10.10","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10.10","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}},{"displayText":"Node 10.6","value":"10.6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10.6","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}},{"displayText":"Node 10.1","value":"10.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|10.1","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"10.x"},"endOfLifeDate":"2021-04-01T00:00:00Z"}}}]},{"displayText":"Node 9","value":"9","minorVersions":[{"displayText":"Node 9.4","value":"9.4","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|9.4","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-06-30T00:00:00Z"}}}]},{"displayText":"Node 8","value":"8","minorVersions":[{"displayText":"Node 8 LTS","value":"8-lts","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8-lts","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.12","value":"8.12","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.12","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.11","value":"8.11","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.11","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.9","value":"8.9","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.9","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.8","value":"8.8","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.8","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.2","value":"8.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.2","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.1","value":"8.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.1","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}},{"displayText":"Node 8.0","value":"8.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|8.0","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-12-31T00:00:00Z"}}}]},{"displayText":"Node 6","value":"6","minorVersions":[{"displayText":"Node 6 LTS","value":"6-LTS","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|6-lts","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-04-30T00:00:00Z"}}},{"displayText":"Node 6.11","value":"6.11","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|6.11","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-04-30T00:00:00Z"}}},{"displayText":"Node 6.10","value":"6.10","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|6.10","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-04-30T00:00:00Z"}}},{"displayText":"Node 6.9","value":"6.9","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|6.9","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-04-30T00:00:00Z"}}},{"displayText":"Node 6.6","value":"6.6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|6.6","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-04-30T00:00:00Z"}}},{"displayText":"Node 6.2","value":"6.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|6.2","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2019-04-30T00:00:00Z"}}}]},{"displayText":"Node 4","value":"4","minorVersions":[{"displayText":"Node 4.8","value":"4.8","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|4.8","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2018-04-30T00:00:00Z"}}},{"displayText":"Node 4.5","value":"4.5","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|4.5","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2018-04-30T00:00:00Z"}}},{"displayText":"Node 4.4","value":"4.4","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"NODE|4.4","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":true},"gitHubActionSettings":{"isSupported":true},"endOfLifeDate":"2018-04-30T00:00:00Z"}}}]}]}},{"id":null,"name":"python","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"Python","value":"python","preferredOs":"linux","majorVersions":[{"displayText":"Python 3","value":"3","minorVersions":[{"displayText":"Python 3.12","value":"3.12","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.12","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.12"},"supportedFeatures":{"disableSsh":true}}}},{"displayText":"Python 3.11","value":"3.11","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.11","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.11"},"supportedFeatures":{"disableSsh":true},"isHidden":false}}},{"displayText":"Python 3.10","value":"3.10","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.10","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.10"},"supportedFeatures":{"disableSsh":true},"isHidden":false,"isEarlyAccess":false}}},{"displayText":"Python 3.9","value":"3.9","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.9","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.9"},"supportedFeatures":{"disableSsh":true},"isHidden":false}}},{"displayText":"Python 3.8","value":"3.8","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.8","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.8"},"supportedFeatures":{"disableSsh":true}}}},{"displayText":"Python 3.7","value":"3.7","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.7","remoteDebuggingSupported":false,"isDeprecated":true,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.7"},"supportedFeatures":{"disableSsh":true}}}},{"displayText":"Python 3.6","value":"3.6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|3.6","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"3.6"}}}}]},{"displayText":"Python 2","value":"2","minorVersions":[{"displayText":"Python 2.7","value":"2.7","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PYTHON|2.7","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"2.7"},"endOfLifeDate":"2020-02-01T00:00:00Z"}}}]}]}},{"id":null,"name":"php","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"PHP","value":"php","preferredOs":"linux","majorVersions":[{"displayText":"PHP 8","value":"8","minorVersions":[{"displayText":"PHP 8.2","value":"8.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|8.2","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8.2"},"supportedFeatures":{"disableSsh":true},"endOfLifeDate":"2025-12-08T00:00:00Z"}}},{"displayText":"PHP 8.1","value":"8.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|8.1","isHidden":false,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8.1"},"supportedFeatures":{"disableSsh":true},"endOfLifeDate":"2023-11-26T00:00:00Z"}}},{"displayText":"PHP 8.0","value":"8.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|8.0","isHidden":false,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8.0"},"supportedFeatures":{"disableSsh":true},"endOfLifeDate":"2023-11-26T00:00:00Z"}}}]},{"displayText":"PHP 7","value":"7","minorVersions":[{"displayText":"PHP 7.4","value":"7.4","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|7.4","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"7.4","notSupportedInCreates":true},"isDeprecated":true,"endOfLifeDate":"2022-11-30T00:00:00Z"}}},{"displayText":"PHP 7.3","value":"7.3","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|7.3","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"7.3","notSupportedInCreates":true},"endOfLifeDate":"2021-12-06T00:00:00Z"}}},{"displayText":"PHP 7.2","value":"7.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|7.2","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2020-11-30T00:00:00Z"}}},{"displayText":"7.0","value":"7.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|7.0","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2020-02-01T00:00:00Z"}}}]},{"displayText":"PHP 5","value":"5","minorVersions":[{"displayText":"PHP 5.6","value":"5.6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"PHP|5.6","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2021-02-01T00:00:00Z"}}}]}]}},{"id":null,"name":"ruby","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"Ruby","value":"ruby","preferredOs":"linux","majorVersions":[{"displayText":"Ruby 2","value":"2","minorVersions":[{"displayText":"Ruby 2.7","value":"2.7","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.7","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2023-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.7.3","value":"2.7.3","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.7.3","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"isHidden":true,"endOfLifeDate":"2023-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.6","value":"2.6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.6","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2022-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.6.2","value":"2.6.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.6.2","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2022-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.5","value":"2.5","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.5","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2021-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.5.5","value":"2.5.5","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.5.5","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2021-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.4","value":"2.4","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.4","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2020-04-01T00:00:00Z"}}},{"displayText":"Ruby 2.4.5","value":"2.4.5","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.4.5","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2020-04-01T00:00:00Z"}}},{"displayText":"Ruby 2.3","value":"2.3","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.3","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2019-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.3.8","value":"2.3.8","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.3.8","isDeprecated":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2019-03-31T00:00:00Z"}}},{"displayText":"Ruby 2.3.3","value":"2.3.3","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"RUBY|2.3.3","remoteDebuggingSupported":false,"isDeprecated":true,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"endOfLifeDate":"2019-03-31T00:00:00Z"}}}]}]}},{"id":null,"name":"java","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"Java","value":"java","preferredOs":"linux","majorVersions":[{"displayText":"Java 17","value":"17","minorVersions":[{"displayText":"Java 17","value":"17.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","isAutoUpdate":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"17"},"endOfLifeDate":"2031-09-01T00:00:00Z"}}},{"displayText":"Java 17.0.4","value":"17.0.4","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"17"},"endOfLifeDate":"2031-09-01T00:00:00Z"}}},{"displayText":"Java 17.0.3","value":"17.0.3","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"17"},"endOfLifeDate":"2031-09-01T00:00:00Z"}}},{"displayText":"Java 17.0.2","value":"17.0.2","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"17"},"endOfLifeDate":"2031-09-01T00:00:00Z"}}},{"displayText":"Java 17.0.1","value":"17.0.1","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"17"},"endOfLifeDate":"2031-09-01T00:00:00Z"}}}]},{"displayText":"Java 11","value":"11","minorVersions":[{"displayText":"Java 11","value":"11.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","isAutoUpdate":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.16","value":"11.0.16","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.15","value":"11.0.15","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.14","value":"11.0.14","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.13","value":"11.0.13","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.12","value":"11.0.12","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.11","value":"11.0.11","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.9","value":"11.0.9","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.7","value":"11.0.7","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.6","value":"11.0.6","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}},{"displayText":"Java 11.0.5","value":"11.0.5","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"11"},"endOfLifeDate":"2026-09-01T00:00:00Z"}}}]},{"displayText":"Java 8","value":"8","minorVersions":[{"displayText":"Java 8","value":"8.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","isAutoUpdate":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8"},"endOfLifeDate":"2025-03-01T00:00:00Z"}}},{"displayText":"Java 1.8.0_275","value":"8.0.275","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8"},"endOfLifeDate":"2025-03-01T00:00:00Z"}}},{"displayText":"Java 1.8.0_252","value":"8.0.252","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8"},"endOfLifeDate":"2025-03-01T00:00:00Z"}}},{"displayText":"Java 1.8.0_242","value":"8.0.242","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8"},"endOfLifeDate":"2025-03-01T00:00:00Z"}}},{"displayText":"Java 1.8.0_232","value":"8.0.232","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":true,"isDefaultOff":false},"gitHubActionSettings":{"isSupported":true,"supportedVersion":"8"},"endOfLifeDate":"2025-03-01T00:00:00Z"}}}]}]}},{"id":null,"name":"javacontainers","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"Java Containers","value":"javacontainers","majorVersions":[{"displayText":"Java SE (Embedded Web Server)","value":"javase","minorVersions":[{"displayText":"Java SE (Embedded Web Server)","value":"SE","stackSettings":{"linuxContainerSettings":{"java17Runtime":"JAVA|17-java17","java11Runtime":"JAVA|11-java11","java8Runtime":"JAVA|8-jre8","isAutoUpdate":true}}},{"displayText":"Java SE 17.0.4","value":"17.0.4","stackSettings":{"linuxContainerSettings":{"java17Runtime":"JAVA|17.0.4"}}},{"displayText":"Java SE 17.0.3","value":"17.0.3","stackSettings":{"linuxContainerSettings":{"java17Runtime":"JAVA|17.0.3"}}},{"displayText":"Java SE 17.0.2","value":"17.0.2","stackSettings":{"linuxContainerSettings":{"java17Runtime":"JAVA|17.0.2"}}},{"displayText":"Java SE 17.0.1","value":"17.0.1","stackSettings":{"linuxContainerSettings":{"java17Runtime":"JAVA|17.0.1"}}},{"displayText":"Java SE 11.0.16","value":"11.0.16","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.16"}}},{"displayText":"Java SE 11.0.15","value":"11.0.15","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.15"}}},{"displayText":"Java SE 11.0.14","value":"11.0.14","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.14"}}},{"displayText":"Java SE 11.0.13","value":"11.0.13","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.13"}}},{"displayText":"Java SE 11.0.12","value":"11.0.12","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.12"}}},{"displayText":"Java SE 11.0.11","value":"11.0.11","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.11"}}},{"displayText":"Java SE 11.0.9","value":"11.0.9","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.9"}}},{"displayText":"Java SE 11.0.7","value":"11.0.7","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.7"}}},{"displayText":"Java SE 11.0.6","value":"11.0.6","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.6"}}},{"displayText":"Java SE 11.0.5","value":"11.0.5","stackSettings":{"linuxContainerSettings":{"java11Runtime":"JAVA|11.0.5"}}},{"displayText":"Java SE 8u345","value":"1.8.345","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u345"}}},{"displayText":"Java SE 8u332","value":"1.8.332","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u332"}}},{"displayText":"Java SE 8u322","value":"1.8.322","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u322"}}},{"displayText":"Java SE 8u312","value":"1.8.312","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u312"}}},{"displayText":"Java SE 8u302","value":"1.8.302","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u302"}}},{"displayText":"Java SE 8u292","value":"1.8.292","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u292"}}},{"displayText":"Java SE 8u275","value":"1.8.275","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u275"}}},{"displayText":"Java SE 8u252","value":"1.8.252","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u252"}}},{"displayText":"Java SE 8u242","value":"1.8.242","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u242"}}},{"displayText":"Java SE 8u232","value":"1.8.232","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JAVA|8u232"}}}]},{"displayText":"Red Hat JBoss EAP 7","value":"jbosseap","minorVersions":[{"displayText":"Red Hat JBoss EAP 7","value":"7","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7-java8","java11Runtime":"JBOSSEAP|7-java11","java17Runtime":"JBOSSEAP|7-java17","isAutoUpdate":true}}},{"displayText":"Red Hat JBoss EAP 7.4.7","value":"7.4.7","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.4.7-java8","java11Runtime":"JBOSSEAP|7.4.7-java11","java17Runtime":"JBOSSEAP|7.4.7-java17"}}},{"displayText":"Red Hat JBoss EAP 7.4.5","value":"7.4.5","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.4.5-java8","java11Runtime":"JBOSSEAP|7.4.5-java11","java17Runtime":"JBOSSEAP|7.4.5-java17"}}},{"displayText":"Red Hat JBoss EAP 7.4.2","value":"7.4.2","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.4.2-java8","java11Runtime":"JBOSSEAP|7.4.2-java11"}}},{"displayText":"Red Hat JBoss EAP 7.4.1","value":"7.4.1","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.4.1-java8","java11Runtime":"JBOSSEAP|7.4.1-java11"}}},{"displayText":"Red Hat JBoss EAP 7.4.0","value":"7.4.0","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.4.0-java8","java11Runtime":"JBOSSEAP|7.4.0-java11"}}},{"displayText":"Red Hat JBoss EAP 7.3.10","value":"7.3.10","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.3.10-java8","java11Runtime":"JBOSSEAP|7.3.10-java11"}}},{"displayText":"Red Hat JBoss EAP 7.3.9","value":"7.3.9","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.3.9-java8","java11Runtime":"JBOSSEAP|7.3.9-java11"}}},{"displayText":"Red Hat JBoss EAP 7.3","value":"7.3","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.3-java8","java11Runtime":"JBOSSEAP|7.3-java11","isAutoUpdate":true,"isHidden":true}}},{"displayText":"Red Hat JBoss EAP 7.4","value":"7.4","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.4-java8","java11Runtime":"JBOSSEAP|7.4-java11","isAutoUpdate":true,"isHidden":true}}},{"displayText":"JBoss EAP 7.2","value":"7.2.0","stackSettings":{"linuxContainerSettings":{"java8Runtime":"JBOSSEAP|7.2-java8","isDeprecated":true}}}]},{"displayText":"Apache Tomcat 10.0","value":"tomcat10.0","minorVersions":[{"displayText":"Apache Tomcat 10.0","value":"10.0","stackSettings":{"linuxContainerSettings":{"java17Runtime":"TOMCAT|10.0-java17","java11Runtime":"TOMCAT|10.0-java11","java8Runtime":"TOMCAT|10.0-jre8","isAutoUpdate":true}}},{"displayText":"Apache Tomcat 10.0.23","value":"10.0.23","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|10.0.23-java8","java11Runtime":"TOMCAT|10.0.23-java11","java17Runtime":"TOMCAT|10.0.23-java17"}}},{"displayText":"Apache Tomcat 10.0.21","value":"10.0.21","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|10.0.21-java8","java11Runtime":"TOMCAT|10.0.21-java11","java17Runtime":"TOMCAT|10.0.21-java17"}}},{"displayText":"Apache Tomcat 10.0.20","value":"10.0.20","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|10.0.20-java8","java11Runtime":"TOMCAT|10.0.20-java11","java17Runtime":"TOMCAT|10.0.20-java17"}}},{"displayText":"Apache Tomcat 10.0.12","value":"10.0.12","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|10.0.12-java8","java11Runtime":"TOMCAT|10.0.12-java11","java17Runtime":"TOMCAT|10.0.12-java17"}}}]},{"displayText":"Apache Tomcat 9.0","value":"tomcat9.0","minorVersions":[{"displayText":"Apache Tomcat 9.0","value":"9.0","stackSettings":{"linuxContainerSettings":{"java17Runtime":"TOMCAT|9.0-java17","java11Runtime":"TOMCAT|9.0-java11","java8Runtime":"TOMCAT|9.0-jre8","isAutoUpdate":true}}},{"displayText":"Apache Tomcat 9.0.65","value":"9.0.65","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.65-java8","java11Runtime":"TOMCAT|9.0.65-java11","java17Runtime":"TOMCAT|9.0.65-java17"}}},{"displayText":"Apache Tomcat 9.0.63","value":"9.0.63","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.63-java8","java11Runtime":"TOMCAT|9.0.63-java11","java17Runtime":"TOMCAT|9.0.63-java17"}}},{"displayText":"Apache Tomcat 9.0.62","value":"9.0.62","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.62-java8","java11Runtime":"TOMCAT|9.0.62-java11","java17Runtime":"TOMCAT|9.0.62-java17"}}},{"displayText":"Apache Tomcat 9.0.54","value":"9.0.54","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.54-java8","java11Runtime":"TOMCAT|9.0.54-java11","java17Runtime":"TOMCAT|9.0.54-java17"}}},{"displayText":"Apache Tomcat 9.0.52","value":"9.0.52","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.52-java8","java11Runtime":"TOMCAT|9.0.52-java11"}}},{"displayText":"Apache Tomcat 9.0.46","value":"9.0.46","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.46-java8","java11Runtime":"TOMCAT|9.0.46-java11"}}},{"displayText":"Apache Tomcat 9.0.41","value":"9.0.41","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|9.0.41-java8","java11Runtime":"TOMCAT|9.0.41-java11"}}},{"displayText":"Apache Tomcat 9.0.37","value":"9.0.37","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|9.0.37-java11","java8Runtime":"TOMCAT|9.0.37-java8"}}},{"displayText":"Apache Tomcat 9.0.33","value":"9.0.33","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|9.0.33-java11","java8Runtime":"TOMCAT|9.0.33-java8"}}},{"displayText":"Apache Tomcat 9.0.20","value":"9.0.20","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|9.0.20-java11","java8Runtime":"TOMCAT|9.0.20-java8"}}}]},{"displayText":"Apache Tomcat 8.5","value":"tomcat8.5","minorVersions":[{"displayText":"Apache Tomcat 8.5","value":"8.5","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|8.5-java11","java8Runtime":"TOMCAT|8.5-jre8","isAutoUpdate":true}}},{"displayText":"Apache Tomcat 8.5.82","value":"8.5.82","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.82-java8","java11Runtime":"TOMCAT|8.5.82-java11"}}},{"displayText":"Apache Tomcat 8.5.79","value":"8.5.79","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.79-java8","java11Runtime":"TOMCAT|8.5.79-java11"}}},{"displayText":"Apache Tomcat 8.5.78","value":"8.5.78","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.78-java8","java11Runtime":"TOMCAT|8.5.78-java11"}}},{"displayText":"Apache Tomcat 8.5.72","value":"8.5.72","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.72-java8","java11Runtime":"TOMCAT|8.5.72-java11"}}},{"displayText":"Apache Tomcat 8.5.69","value":"8.5.69","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.69-java8","java11Runtime":"TOMCAT|8.5.69-java11"}}},{"displayText":"Apache Tomcat 8.5.66","value":"8.5.66","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.66-java8","java11Runtime":"TOMCAT|8.5.66-java11"}}},{"displayText":"Apache Tomcat 8.5.61","value":"8.5.61","stackSettings":{"linuxContainerSettings":{"java8Runtime":"TOMCAT|8.5.61-java8","java11Runtime":"TOMCAT|8.5.61-java11"}}},{"displayText":"Apache Tomcat 8.5.57","value":"8.5.57","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|8.5.57-java11","java8Runtime":"TOMCAT|8.5.57-java8"}}},{"displayText":"Apache Tomcat 8.5.53","value":"8.5.53","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|8.5.53-java11","java8Runtime":"TOMCAT|8.5.53-java8"}}},{"displayText":"Apache Tomcat 8.5.41","value":"8.5.41","stackSettings":{"linuxContainerSettings":{"java11Runtime":"TOMCAT|8.5.41-java11","java8Runtime":"TOMCAT|8.5.41-java8"}}}]},{"displayText":"WildFly 14","value":"wildfly14","minorVersions":[{"displayText":"WildFly 14","value":"14","stackSettings":{"linuxContainerSettings":{"java8Runtime":"WILDFLY|14-jre8","isDeprecated":true,"isAutoUpdate":true}}},{"displayText":"WildFly 14.0.1","value":"14.0.1","stackSettings":{"linuxContainerSettings":{"isDeprecated":true,"java8Runtime":"WILDFLY|14.0.1-java8"}}}]}]}},{"id":null,"name":"staticsite","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"HTML (Static Content)","value":"staticsite","preferredOs":"linux","majorVersions":[{"displayText":"HTML (Static Content)","value":"1","minorVersions":[{"displayText":"HTML (Static Content)","value":"1.0","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"STATICSITE|1.0","isHidden":true,"remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false}}}}]}]}},{"id":null,"name":"go","type":"Microsoft.Web/webAppStacks?stackOsType=Linux","properties":{"displayText":"Go","value":"go","preferredOs":"linux","majorVersions":[{"displayText":"Go 1","value":"go1","minorVersions":[{"displayText":"Go 1.19 (Experimental)","value":"go1.19","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"GO|1.19","remoteDebuggingSupported":false,"isDeprecated":true,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":true},"supportedFeatures":{"disableSsh":true},"isHidden":false,"isEarlyAccess":false}}},{"displayText":"Go 1.18 (Experimental)","value":"go1.18","stackSettings":{"linuxRuntimeSettings":{"runtimeVersion":"GO|1.18","remoteDebuggingSupported":false,"appInsightsSettings":{"isSupported":false},"gitHubActionSettings":{"isSupported":false},"supportedFeatures":{"disableSsh":true},"isHidden":false,"isEarlyAccess":false,"isDeprecated":true}}}]}]}}],"nextLink":null,"id":null}`);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.json',
            format: 'json',
            transformTemplates: ['{"releases": $$.value[name="python"].properties.majorVersions[value="3"].minorVersions.({"version": $.value, "isDeprecated": $.stackSettings.linuxRuntimeSettings.isDeprecated})}']
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return null for plain text file if the body is not what is expected', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.version',
            format: 'plain',
          },
        },
      });

      expect(result).toBeNull();
    });

    it('return releases for plain text file directly exposing in Renovate format', async () => {
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

      fs.readLocalFile.mockResolvedValueOnce(codeBlock`{
        1.0.0
        2.0.0
        3.0.0
      }`);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.version',
            format: 'plain',
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
          },
        ],
      };

      const content = html`
        <html>
          <body>
            <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
          </body>
        </html>
      `;

      httpMock
        .scope('https://example.com')
        .get('/index.html')
        .reply(200, content, {
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

    it('return releases from HTML links - local file', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
          <body>
            <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
          </body>
        </html>
      `;

      fs.readLocalFile.mockResolvedValueOnce(content);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return null for local file read error - HTML format', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.html',
            format: 'html',
          },
        },
      });

      expect(result).toBeNull();
    });

    it('return releases from nginx directory listing', async () => {
      const expected = {
        releases: [
          {
            version: 'nginx-0.1.0.tar.gz',
          },
          {
            version: 'nginx-0.1.1.tar.gz',
          },
          {
            version: 'nginx-0.1.11.tar.gz',
          },
        ],
      };

      httpMock
        .scope('http://nginx.org')
        .get('/download/')
        .reply(200, Fixtures.get('nginx-downloads.html'), {
          'Content-Type': 'text/html',
        })
        .get('/download')
        .reply(301, undefined, {
          Location: 'http://nginx.org/download/',
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

      expect(result).toEqual(expected);
    });

    it('return releases for malformed HTML', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
        <body>
        <h1></pre><hr></body><a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
        </html>
      `;

      httpMock
        .scope('https://example.com')
        .get('/malformed.html')
        .reply(200, content, {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/malformed.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });

    it('return releases for incomplete HTML', async () => {
      const expected = {
        releases: [
          {
            version: 'package-1.0.tar.gz',
          },
        ],
      };

      const content = html`
        <html>
        <body>
        <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
        <a href="package-2.0.tar.gz
      `;

      httpMock
        .scope('https://example.com')
        .get('/incomplete.html')
        .reply(200, content, {
          'Content-Type': 'text/html',
        });

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'https://example.com/incomplete.html',
            format: 'html',
          },
        },
      });

      expect(result).toEqual(expected);
    });
  });
});
