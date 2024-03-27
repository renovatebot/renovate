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
        releases: [
          {
            version: '3.6',
            isDeprecated: true,
          },
          {
            version: '3.7',
            isDeprecated: true,
          },
          {
            version: '3.8',
          },
          {
            version: '3.9',
          },
          {
            version: '3.10',
          },
          {
            version: '3.11',
          },
          {
            version: '3.12',
          },
        ],
      };

      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
        {
          "value": [
            {
              "id": null,
              "name": "python",
              "type": "Microsoft.Web/webAppStacks?stackOsType=Linux",
              "properties": {
                "displayText": "Python",
                "value": "python",
                "preferredOs": "linux",
                "majorVersions": [
                  {
                    "displayText": "Python 3",
                    "value": "3",
                    "minorVersions": [
                      {
                        "displayText": "Python 3.12",
                        "value": "3.12",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.12",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.12"
                            },
                            "supportedFeatures": { "disableSsh": true }
                          }
                        }
                      },
                      {
                        "displayText": "Python 3.11",
                        "value": "3.11",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.11",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.11"
                            },
                            "supportedFeatures": { "disableSsh": true },
                            "isHidden": false
                          }
                        }
                      },
                      {
                        "displayText": "Python 3.10",
                        "value": "3.10",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.10",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.10"
                            },
                            "supportedFeatures": { "disableSsh": true },
                            "isHidden": false,
                            "isEarlyAccess": false
                          }
                        }
                      },
                      {
                        "displayText": "Python 3.9",
                        "value": "3.9",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.9",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.9"
                            },
                            "supportedFeatures": { "disableSsh": true },
                            "isHidden": false
                          }
                        }
                      },
                      {
                        "displayText": "Python 3.8",
                        "value": "3.8",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.8",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.8"
                            },
                            "supportedFeatures": { "disableSsh": true }
                          }
                        }
                      },
                      {
                        "displayText": "Python 3.7",
                        "value": "3.7",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.7",
                            "remoteDebuggingSupported": false,
                            "isDeprecated": true,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.7"
                            },
                            "supportedFeatures": { "disableSsh": true }
                          }
                        }
                      },
                      {
                        "displayText": "Python 3.6",
                        "value": "3.6",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|3.6",
                            "isDeprecated": true,
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "3.6"
                            }
                          }
                        }
                      }
                    ]
                  },
                  {
                    "displayText": "Python 2",
                    "value": "2",
                    "minorVersions": [
                      {
                        "displayText": "Python 2.7",
                        "value": "2.7",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "PYTHON|2.7",
                            "isDeprecated": true,
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "2.7"
                            },
                            "endOfLifeDate": "2020-02-01T00:00:00Z"
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            },
            {
              "id": null,
              "name": "java",
              "type": "Microsoft.Web/webAppStacks?stackOsType=Linux",
              "properties": {
                "displayText": "Java",
                "value": "java",
                "preferredOs": "linux",
                "majorVersions": [
                  {
                    "displayText": "Java 17",
                    "value": "17",
                    "minorVersions": [
                      {
                        "displayText": "Java 17",
                        "value": "17.0",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "",
                            "isAutoUpdate": true,
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": {
                              "isSupported": true,
                              "isDefaultOff": false
                            },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "17"
                            },
                            "endOfLifeDate": "2031-09-01T00:00:00Z"
                          }
                        }
                      },
                      {
                        "displayText": "Java 17.0.4",
                        "value": "17.0.4",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": {
                              "isSupported": true,
                              "isDefaultOff": false
                            },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "17"
                            },
                            "endOfLifeDate": "2031-09-01T00:00:00Z"
                          }
                        }
                      },
                      {
                        "displayText": "Java 17.0.3",
                        "value": "17.0.3",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": {
                              "isSupported": true,
                              "isDefaultOff": false
                            },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "17"
                            },
                            "endOfLifeDate": "2031-09-01T00:00:00Z"
                          }
                        }
                      }
                    ]
                  },
                  {
                    "displayText": "Java 11",
                    "value": "11",
                    "minorVersions": [
                      {
                        "displayText": "Java 11",
                        "value": "11.0",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "",
                            "isAutoUpdate": true,
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": {
                              "isSupported": true,
                              "isDefaultOff": false
                            },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "11"
                            },
                            "endOfLifeDate": "2026-09-01T00:00:00Z"
                          }
                        }
                      },
                      {
                        "displayText": "Java 11.0.16",
                        "value": "11.0.16",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": {
                              "isSupported": true,
                              "isDefaultOff": false
                            },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "11"
                            },
                            "endOfLifeDate": "2026-09-01T00:00:00Z"
                          }
                        }
                      },
                      {
                        "displayText": "Java 11.0.15",
                        "value": "11.0.15",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": {
                              "isSupported": true,
                              "isDefaultOff": false
                            },
                            "gitHubActionSettings": {
                              "isSupported": true,
                              "supportedVersion": "11"
                            },
                            "endOfLifeDate": "2026-09-01T00:00:00Z"
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            },
            {
              "id": null,
              "name": "staticsite",
              "type": "Microsoft.Web/webAppStacks?stackOsType=Linux",
              "properties": {
                "displayText": "HTML (Static Content)",
                "value": "staticsite",
                "preferredOs": "linux",
                "majorVersions": [
                  {
                    "displayText": "HTML (Static Content)",
                    "value": "1",
                    "minorVersions": [
                      {
                        "displayText": "HTML (Static Content)",
                        "value": "1.0",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "STATICSITE|1.0",
                            "isHidden": true,
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": { "isSupported": false }
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            },
            {
              "id": null,
              "name": "go",
              "type": "Microsoft.Web/webAppStacks?stackOsType=Linux",
              "properties": {
                "displayText": "Go",
                "value": "go",
                "preferredOs": "linux",
                "majorVersions": [
                  {
                    "displayText": "Go 1",
                    "value": "go1",
                    "minorVersions": [
                      {
                        "displayText": "Go 1.19 (Experimental)",
                        "value": "go1.19",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "GO|1.19",
                            "remoteDebuggingSupported": false,
                            "isDeprecated": true,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": { "isSupported": true },
                            "supportedFeatures": { "disableSsh": true },
                            "isHidden": false,
                            "isEarlyAccess": false
                          }
                        }
                      },
                      {
                        "displayText": "Go 1.18 (Experimental)",
                        "value": "go1.18",
                        "stackSettings": {
                          "linuxRuntimeSettings": {
                            "runtimeVersion": "GO|1.18",
                            "remoteDebuggingSupported": false,
                            "appInsightsSettings": { "isSupported": false },
                            "gitHubActionSettings": { "isSupported": false },
                            "supportedFeatures": { "disableSsh": true },
                            "isHidden": false,
                            "isEarlyAccess": false,
                            "isDeprecated": true
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            }
          ],
          "nextLink": null,
          "id": null
        }
        `,
      );

      const result = await getPkgReleases({
        datasource: `${CustomDatasource.id}.foo`,
        packageName: 'myPackage',
        customDatasources: {
          foo: {
            defaultRegistryUrlTemplate: 'file://test.json',
            format: 'json',
            transformTemplates: [
              '{"releases": $$.value[name="python"].properties.majorVersions[value="3"].minorVersions.({"version": $.value, "isDeprecated": $.stackSettings.linuxRuntimeSettings.isDeprecated})}',
            ],
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
