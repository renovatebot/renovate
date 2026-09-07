import { Readable } from 'node:stream';
import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import tmp from 'tmp-promise';
import { mockDeep } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as _packageCache from '../../../util/cache/package/index.ts';
import { id as versioning } from '../../versioning/nuget/index.ts';
import { getPkgReleases } from '../index.ts';
import { parseRegistryUrl } from './common.ts';
import { NugetDatasource } from './index.ts';

const datasource = NugetDatasource.id;

vi.mock('../../../util/cache/package/index.ts', () => mockDeep());

const packageCache = vi.mocked(_packageCache);

const pkgInfoV3FromNuget = Fixtures.get('nunit/v3_nuget_org.xml');
const pkgListV3Registration = Fixtures.get('nunit/v3_registration.json');

const pkgInfoV3Deprecated = Fixtures.get('proxykit/v3.xml');
const pkgListV3Deprecated = Fixtures.get('proxykit/v3_registration.json');

const pkgListV2 = Fixtures.get('nunit/v2.xml');
const pkgListV2NoGitHubProjectUrl = Fixtures.get(
  'nunit/v2_noGitHubProjectUrl.xml',
);
const pkgListV2NoRelease = Fixtures.get('nunit/v2_no_release.xml');

const pkgListV2Page1of2 = Fixtures.get('nunit/v2_paginated_1.xml');
const pkgListV2Page2of2 = Fixtures.get('nunit/v2_paginated_2.xml');

const nugetIndexV3 = Fixtures.get('v3_index.json');

const nlogMocks = [
  {
    url: '/v3/registration5-gz-semver2/nlog/index.json',
    result: Fixtures.get('nlog/v3_registration.json'),
  },
  {
    url: '/v3/registration5-gz-semver2/nlog/page/1.0.0.505/4.4.0-beta5.json',
    result: Fixtures.get('nlog/v3_catalog_1.json'),
  },
  {
    url: '/v3/registration5-gz-semver2/nlog/page/4.4.0-beta6/4.6.0-rc2.json',
    result: Fixtures.get('nlog/v3_catalog_2.json'),
  },
  {
    url: '/v3/registration5-gz-semver2/nlog/page/4.6.0-rc3/5.0.0-beta11.json',
    result: Fixtures.get('nlog/v3_catalog_3.json'),
  },
  {
    url: '/v3-flatcontainer/nlog/4.7.3/nlog.nuspec',
    result: Fixtures.get('nlog/nuspec.xml'),
  },
];

const configV3V2 = {
  datasource,
  versioning,
  packageName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://www.nuget.org/api/v2/',
  ],
};

const configV2 = {
  datasource,
  versioning,
  packageName: 'nunit',
  registryUrls: ['https://www.nuget.org/api/v2/'],
};

const configV3 = {
  datasource,
  versioning,
  packageName: 'nunit',
  registryUrls: ['https://api.nuget.org/v3/index.json'],
};

const configV3NotNugetOrg = {
  datasource,
  versioning,
  packageName: 'nunit',
  registryUrls: ['https://myprivatefeed/index.json'],
};

const configV3Multiple = {
  datasource,
  versioning,
  packageName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://myprivatefeed/index.json',
  ],
};

const configV3AzureDevOps = {
  datasource,
  versioning,
  packageName: 'nunit',
  registryUrls: [
    'https://pkgs.dev.azure.com/organisationName/_packaging/2745c5e9-610a-4537-9032-978c66527b51/nuget/v3/index.json',
  ],
};

const configV3Deprecated = {
  datasource,
  versioning,
  packageName: 'ProxyKit',
  registryUrls: ['https://api.nuget.org/v3/index.json'],
};

describe('modules/datasource/nuget/index', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    vi.stubEnv('RENOVATE_X_NUGET_PAGINATION_ALLOW_CROSS_ORIGIN', undefined);
  });

  describe('parseRegistryUrl', () => {
    it('extracts feed version from registry URL hash (v3)', () => {
      const parsed = parseRegistryUrl('https://my-registry#protocolVersion=3');

      expect(parsed.feedUrl).toBe('https://my-registry/');
      expect(parsed.protocolVersion).toBe(3);
    });

    it('extracts feed version from registry URL hash (v2)', () => {
      const parsed = parseRegistryUrl('https://my-registry#protocolVersion=2');

      expect(parsed.feedUrl).toBe('https://my-registry/');
      expect(parsed.protocolVersion).toBe(2);
    });

    it('defaults to v2', () => {
      const parsed = parseRegistryUrl('https://my-registry');

      expect(parsed.feedUrl).toBe('https://my-registry/');
      expect(parsed.protocolVersion).toBe(2);
    });

    it('returns null for unparseable', () => {
      const parsed = parseRegistryUrl('https://test.example.com:abc');

      expect(parsed.feedUrl).toBe('https://test.example.com:abc');
      expect(parsed.protocolVersion).toBeNull();
    });
  });

  describe('getReleases', () => {
    it(`can't detect nuget feed version`, async () => {
      const config = {
        datasource,
        versioning,
        packageName: 'nunit',
        registryUrls: ['#$#api.nuget.org/v3/index.xml'],
      };

      await expect(
        getPkgReleases({
          ...config,
        }),
      ).resolves.toBeNull();
    });

    it('extracts feed version from registry URL hash', async () => {
      httpMock.scope('https://my-registry').get('/').reply(200);
      const config = {
        datasource,
        versioning,
        packageName: 'nunit',
        registryUrls: ['https://my-registry#protocolVersion=3'],
      };
      await expect(
        getPkgReleases({
          ...config,
        }),
      ).resolves.toBeNull();
    });

    it(`can't get packages list (v3)`, async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(500);

      const res = await getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
    });

    it(`empty packages list (v3)`, async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, {});

      const res = await getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
    });

    it('skips catalog page without @id or items (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, {
          items: [
            {
              // no @id and no items - should be skipped gracefully
            },
          ],
        });

      const res = await getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
    });

    it('returns null for empty result (v3v2)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, {});
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200);
      await expect(
        getPkgReleases({
          ...configV3V2,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty result (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, {});
      await expect(
        getPkgReleases({
          ...configV2,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty result (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, {});
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res).toBeNull();
    });

    it('logs instead of triggering a TypeError when PackageBaseAddress is missing from service index', async () => {
      const nugetIndex = `
        {
          "version": "3.0.0",
          "resources": [
            {
              "@id": "https://api.nuget.org/v3/metadata",
              "@type": "RegistrationsBaseUrl/3.0.0-beta",
              "comment": "Get package metadata."
            }
          ]
        }
      `;
      const nunitRegistration = `
        {
          "count": 1,
          "items": [
            {
              "@id": "https://api.nuget.org/v3/metadata/nunit/5.0.json",
              "lower": "5.0",
              "upper": "5.0",
              "count": 1,
              "items": [
                {
                  "@id": "foo",
                  "packageContent": "foo",
                  "catalogEntry": {
                    "id": "nunit",
                    "version": "5.0"
                  }
                }
              ]
            }
          ]
        }
      `;

      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndex)
        .get('/v3/metadata/nunit/index.json')
        .reply(200, nunitRegistration);
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res).not.toBeNull();
      expect(res!.releases).toHaveLength(1);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          url: 'https://api.nuget.org/v3/index.json',
          servicesIndexRaw: {
            resources: [
              {
                '@id': 'https://api.nuget.org/v3/metadata',
                '@type': 'RegistrationsBaseUrl/3.0.0-beta',
              },
            ],
          },
        },
        'no PackageBaseAddress services found',
      );
    });

    describe('determine source URL from nupkg', () => {
      // These tests really download the .nupkg to disk, so give them a
      // throwaway directory instead of a fixed path under the system tmpdir.
      let cacheDirResult: DirectoryResult;

      beforeEach(async () => {
        cacheDirResult = await tmp.dir({ unsafeCleanup: true });
        GlobalConfig.set({ cacheDir: cacheDirResult.path });
        vi.stubEnv('RENOVATE_X_NUGET_DOWNLOAD_NUPKGS', 'true');
      });

      afterEach(async () => {
        await cacheDirResult?.cleanup();
      });

      it('can determine source URL from nupkg when PackageBaseAddress is missing', async () => {
        const nugetIndex = `
          {
            "version": "3.0.0",
            "resources": [
              {
                "@id": "https://some-registry/v3/metadata",
                "@type": "RegistrationsBaseUrl/3.0.0-beta",
                "comment": "Get package metadata."
              }
            ]
          }
        `;
        const nlogRegistration = `
          {
            "count": 1,
            "items": [
              {
                "@id": "https://some-registry/v3/metadata/nlog/4.7.3.json",
                "lower": "4.7.3",
                "upper": "4.7.3",
                "count": 1,
                "items": [
                  {
                    "@id": "foo",
                    "catalogEntry": {
                      "id": "NLog",
                      "version": "4.7.3",
                      "packageContent": "https://some-registry/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg"
                    }
                  }
                ]
              }
            ]
          }
        `;
        httpMock
          .scope('https://some-registry')
          .get('/v3/index.json')
          .twice()
          .reply(200, nugetIndex)
          .get('/v3/metadata/nlog/index.json')
          .reply(200, nlogRegistration)
          .get('/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg')
          .reply(200, () => {
            const readableStream = new Readable();
            readableStream.push(Fixtures.getBinary('nlog/NLog.4.7.3.nupkg'));
            readableStream.push(null);
            return readableStream;
          });
        const res = await getPkgReleases({
          datasource,
          versioning,
          packageName: 'NLog',
          registryUrls: ['https://some-registry/v3/index.json'],
        });

        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Determined sourceUrl https://github.com/NLog/NLog.git from https://some-registry/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg',
        );
        expect(packageCache.setWithRawTtl).toHaveBeenCalledExactlyOnceWith(
          'datasource-nuget-v3',
          'cache-decorator:source-url:https://some-registry/v3/index.json:NLog',
          {
            cachedAt: expect.any(String),
            value: 'https://github.com/NLog/NLog.git',
          },
          60 * 24 * 7,
        );
        expect(res?.sourceUrl).toBeDefined();
      });

      it('can determine source URL from nupkg when nuspec endpoint returns 404', async () => {
        const nugetIndex = codeBlock`
          {
            "version": "3.0.0",
            "resources": [
              {
                "@id": "https://some-registry/v3/metadata",
                "@type": "RegistrationsBaseUrl/3.0.0-beta",
                "comment": "Get package metadata."
              },
              {
                "@id": "https://some-registry/v3-flatcontainer",
                "@type": "PackageBaseAddress/3.0.0",
                "comment": "Base URL of where NuGet packages are stored."
              }
            ]
          }
        `;
        const nlogRegistration = codeBlock`
          {
            "count": 1,
            "items": [
              {
                "@id": "https://some-registry/v3/metadata/nlog/4.7.3.json",
                "lower": "4.7.3",
                "upper": "4.7.3",
                "count": 1,
                "items": [
                  {
                    "@id": "foo",
                    "catalogEntry": {
                      "id": "NLog",
                      "version": "4.7.3",
                      "packageContent": "https://some-registry/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg"
                    }
                  }
                ]
              }
            ]
          }
        `;
        httpMock
          .scope('https://some-registry')
          .get('/v3/index.json')
          .twice()
          .reply(200, nugetIndex)
          .get('/v3/metadata/nlog/index.json')
          .reply(200, nlogRegistration)
          .get('/v3-flatcontainer/nlog/4.7.3/nlog.nuspec')
          .reply(404)
          .get('/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg')
          .reply(200, () => {
            const readableStream = new Readable();
            readableStream.push(Fixtures.getBinary('nlog/NLog.4.7.3.nupkg'));
            readableStream.push(null);
            return readableStream;
          });
        const res = await getPkgReleases({
          datasource,
          versioning,
          packageName: 'NLog',
          registryUrls: ['https://some-registry/v3/index.json'],
        });

        expect(logger.logger.debug.mock.calls).toEqual(
          expect.arrayContaining([
            [
              {
                registryUrl: 'https://some-registry/v3/index.json',
                pkgName: 'NLog',
                pkgVersion: '4.7.3',
              },
              'package manifest (.nuspec) not found',
            ],
            [
              'Determined sourceUrl https://github.com/NLog/NLog.git from https://some-registry/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg',
            ],
          ]),
        );
        expect(res?.sourceUrl).toBe('https://github.com/NLog/NLog');
      });

      it('can handle nupkg without repository metadata', async () => {
        const nugetIndex = `
          {
            "version": "3.0.0",
            "resources": [
              {
                "@id": "https://some-registry/v3/metadata",
                "@type": "RegistrationsBaseUrl/3.0.0-beta",
                "comment": "Get package metadata."
              }
            ]
          }
        `;
        const nlogRegistration = `
          {
            "count": 1,
            "items": [
              {
                "@id": "https://some-registry/v3/metadata/nlog/4.7.3.json",
                "lower": "4.7.3",
                "upper": "4.7.3",
                "count": 1,
                "items": [
                  {
                    "@id": "foo",
                    "catalogEntry": {
                      "id": "NLog",
                      "version": "4.7.3",
                      "packageContent": "https://some-registry/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg"
                    }
                  }
                ]
              }
            ]
          }
        `;
        httpMock
          .scope('https://some-registry')
          .get('/v3/index.json')
          .twice()
          .reply(200, nugetIndex)
          .get('/v3/metadata/nlog/index.json')
          .reply(200, nlogRegistration)
          .get('/v3-flatcontainer/nlog/4.7.3/nlog.4.7.3.nupkg')
          .reply(200, () => {
            const readableStream = new Readable();
            readableStream.push(
              Fixtures.getBinary('nlog/NLog.4.7.3-no-repo.nupkg'),
            );
            readableStream.push(null);
            return readableStream;
          });
        const res = await getPkgReleases({
          datasource,
          versioning,
          packageName: 'NLog',
          registryUrls: ['https://some-registry/v3/index.json'],
        });
        expect(packageCache.setWithRawTtl).toHaveBeenCalledExactlyOnceWith(
          'datasource-nuget-v3',
          'cache-decorator:source-url:https://some-registry/v3/index.json:NLog',
          {
            cachedAt: expect.any(String),
            value: null,
          },
          60 * 24 * 7,
        );
        expect(res?.sourceUrl).toBeUndefined();
      });
    });

    it('returns null for non 200 (v3v2)', async () => {
      httpMock.scope('https://api.nuget.org').get('/v3/index.json').reply(500);
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(500);
      await expect(
        getPkgReleases({
          ...configV3V2,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for non 200 (v3)', async () => {
      httpMock.scope('https://api.nuget.org').get('/v3/index.json').reply(500);
      await expect(
        getPkgReleases({
          ...configV3,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for non 200 (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(500);
      await expect(
        getPkgReleases({
          ...configV2,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for unknown error (v3v2)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .replyWithError('');
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .replyWithError('');
      await expect(
        getPkgReleases({
          ...configV3V2,
        }),
      ).resolves.toBeNull();
    });

    it('returns deduplicated results', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3)
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .twice()
        .reply(200, pkgInfoV3FromNuget)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .twice()
        .reply(200, pkgListV3Registration);
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .twice()
        .reply(200, nugetIndexV3);

      const res = await getPkgReleases({
        ...configV3Multiple,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.5.7.10213',
            registryUrl: 'https://api.nuget.org/v3/index.json',
            releaseTimestamp: '2011-01-07T07:57:55.387Z',
          },
          {
            version: '2.6.0.12051',
            isDeprecated: true,
            registryUrl: 'https://api.nuget.org/v3/index.json',
          },
          {
            version: '2.6.1',
            registryUrl: 'https://api.nuget.org/v3/index.json',
            releaseTimestamp: '2012-08-05T03:08:28.403Z',
          },
          {
            version: '2.6.2',
            registryUrl: 'https://api.nuget.org/v3/index.json',
            releaseTimestamp: '2012-10-23T15:37:48.000Z',
          },
          {
            version: '3.0.0-alpha',
            registryUrl: 'https://api.nuget.org/v3/index.json',
            releaseTimestamp: '2014-09-23T03:11:33.430Z',
          },
          {
            version: '3.12.0',
            registryUrl: 'https://api.nuget.org/v3/index.json',
            releaseTimestamp: '2019-05-15T00:24:28.390Z',
          },
        ],
        changelogContent:
          'This package includes the NUnit 3 framework assembly, which is referenced by your tests. You will need\n      to install version 3 of the nunit3-console program or a third-party runner that supports NUnit 3 in order to\n      execute tests. Runners intended for use with NUnit 2.x will not run NUnit 3 tests correctly.\n    ',
        sourceUrl: 'https://github.com/nunit/nunit',
        homepage: 'https://nunit.org/',
      });
    });

    it('returns null for unknown error in getReleasesFromV3Feed (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .replyWithError('');
      await expect(
        getPkgReleases({
          ...configV3,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for unknown error in getQueryUrlForV3Feed  (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .replyWithError('');
      await expect(
        getPkgReleases({
          ...configV3,
        }),
      ).resolves.toBeNull();
    });

    it('returns null for unknown error (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .replyWithError('');
      await expect(
        getPkgReleases({
          ...configV2,
        }),
      ).resolves.toBeNull();
    });

    it('processes real data (v3) feed is a nuget.org', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, pkgListV3Registration)
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .reply(200, pkgInfoV3FromNuget);
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.5.7.10213',
            releaseTimestamp: '2011-01-07T07:57:55.387Z',
          },
          {
            version: '2.6.0.12051',
            isDeprecated: true,
          },
          {
            version: '2.6.1',
            releaseTimestamp: '2012-08-05T03:08:28.403Z',
          },
          {
            version: '2.6.2',
            releaseTimestamp: '2012-10-23T15:37:48.000Z',
          },
          {
            version: '3.0.0-alpha',
            releaseTimestamp: '2014-09-23T03:11:33.430Z',
          },
          {
            version: '3.12.0',
            releaseTimestamp: '2019-05-15T00:24:28.390Z',
          },
        ],
        changelogContent:
          'This package includes the NUnit 3 framework assembly, which is referenced by your tests. You will need\n      to install version 3 of the nunit3-console program or a third-party runner that supports NUnit 3 in order to\n      execute tests. Runners intended for use with NUnit 2.x will not run NUnit 3 tests correctly.\n    ',
        sourceUrl: 'https://github.com/nunit/nunit',
        homepage: 'https://nunit.org/',
        registryUrl: 'https://api.nuget.org/v3/index.json',
      });
    });

    it('captures release notes', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, pkgListV3Registration)
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .reply(200, pkgInfoV3FromNuget);
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res?.changelogContent)
        .toBe(`This package includes the NUnit 3 framework assembly, which is referenced by your tests. You will need
      to install version 3 of the nunit3-console program or a third-party runner that supports NUnit 3 in order to
      execute tests. Runners intended for use with NUnit 2.x will not run NUnit 3 tests correctly.
    `);
    });

    it('processes real data (v3) feed is azure devops', async () => {
      httpMock
        .scope('https://pkgs.dev.azure.com')
        .get(
          '/organisationName/_packaging/2745c5e9-610a-4537-9032-978c66527b51/nuget/v3/index.json',
        )
        .twice()
        .reply(200, Fixtures.get('azure_devops/v3_index.json'))
        .get(
          '/organisationName/_packaging/2745c5e9-610a-4537-9032-978c66527b51/nuget/v3/registrations2-semver2/nunit/index.json',
        )
        .reply(200, Fixtures.get('azure_devops/nunit/v3_registration.json'))
        .get(
          '/organisationName/_packaging/2745c5e9-610a-4537-9032-978c66527b51/nuget/v3/flat2/nunit/3.13.2/nunit.nuspec',
        )
        .reply(200, Fixtures.get('azure_devops/nunit/nuspec.xml'));
      const res = await getPkgReleases({
        ...configV3AzureDevOps,
      });
      expect(res).toMatchObject({
        homepage: 'https://nunit.org/',
        registryUrl:
          'https://pkgs.dev.azure.com/organisationName/_packaging/2745c5e9-610a-4537-9032-978c66527b51/nuget/v3/index.json',
        releases: [
          {
            releaseTimestamp: '2021-12-03T03:20:52.000Z',
            version: '2.5.7.10213',
          },
          {
            releaseTimestamp: '2021-12-03T03:20:52.000Z',
            version: '2.6.5',
          },
          {
            releaseTimestamp: '2021-12-03T03:20:52.000Z',
            version: '2.7.1',
          },
          {
            releaseTimestamp: '2021-12-03T03:20:52.000Z',
            version: '3.13.2',
          },
        ],
        sourceUrl: 'https://github.com/nunit/nunit',
      });
    });

    it('processes real data (v3) for several catalog pages', async () => {
      const scope = httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3);
      nlogMocks.forEach(({ url, result }) => {
        scope.get(url).reply(200, result);
      });
      const res = await getPkgReleases({
        ...configV3,
        packageName: 'nlog',
      });
      expect(res).toEqual({
        releases: [
          {
            version: '1.0.0.505',
            releaseTimestamp: '2011-01-07T07:57:35.043Z',
          },
          {
            version: '2.0.1',
            isDeprecated: true,
          },
          {
            version: '3.0.0',
            releaseTimestamp: '2014-06-02T14:47:27.650Z',
          },
          {
            version: '4.4.0-beta5',
            isDeprecated: true,
          },
          {
            version: '4.4.0-beta6',
            isDeprecated: true,
          },
          {
            version: '4.4.0',
            releaseTimestamp: '2016-12-14T10:47:25.290Z',
          },
          {
            version: '4.6.0-rc2',
            isDeprecated: true,
          },
          {
            version: '4.6.0-rc3',
            isDeprecated: true,
          },
          {
            version: '4.7.3',
            releaseTimestamp: '2020-07-31T22:20:36.847Z',
          },
          {
            version: '5.0.0-beta11',
            isDeprecated: true,
          },
        ],
        changelogContent:
          '## Features\n      - Allow to change the RuleName of a LoggingRule (#4017) (@304NotModified)\n      - logging of AggregrateException.Data to prevent it from losing it after Flatten call (#3974) (@chaos0307)\n\n      ## Bugfixes\n      - LocalIpAddressLayoutRenderer - IsDnsEligible and PrefixOrigin throws PlatformNotSupportedException on Linux\n      (#4011) (@snakefoot)\n\n      ## Improvements\n      - ObjectReflectionCache - Reduce noise from properties that throws exceptions like Stream.ReadTimeout (#4057)\n      (@snakefoot)\n      - MessageTemplates - Changed Literal.Skip to be Int32 to support message templates longer than short.MaxValue\n      (#4053) (@snakefoot)\n      - ObjectReflectionCache - Skip reflection for Stream objects (#4043) (@snakefoot)\n      - LogFactory Shutdown is public so it can be used from NLogLoggerProvider (#3999) (@snakefoot)\n      - Editor config with File header template (#3972) (@304NotModified)\n\n      ## Performance\n      - FileTarget - Skip delegate capture in GetFileCreationTimeSource. Fallback only necessary when appender has been\n      closed. (#4058) (@snakefoot)\n      - ObjectReflectionCache - Reduce initial memory allocation until needed (#4021) (@snakefoot)\n      - FilteringTargetWrapper - Remove delegate allocation (#3977) (@snakefoot)\n\n      Full changelog: https://github.com/NLog/NLog/blob/master/CHANGELOG.md\n\n      For all config options and platform support, check https://nlog-project.org/config/\n    ',
        sourceUrl: 'https://github.com/NLog/NLog',
        homepage: 'https://nlog-project.org/',
        registryUrl: 'https://api.nuget.org/v3/index.json',
      });
    });

    it('processes real data (v3) feed is not a nuget.org', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(
          200,
          pkgListV3Registration
            .replace(/"http:\/\/nunit\.org"/g, '""')
            .replace('"published": "2012-10-23T15:37:48+00:00",', ''),
        )
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .reply(
          200,
          pkgInfoV3FromNuget.replace('https://github.com/nunit/nunit', ''),
        );
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .twice()
        .reply(200, nugetIndexV3);

      const res = await getPkgReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.5.7.10213',
            releaseTimestamp: '2011-01-07T07:57:55.387Z',
          },
          {
            version: '2.6.0.12051',
            isDeprecated: true,
          },
          {
            version: '2.6.1',
            releaseTimestamp: '2012-08-05T03:08:28.403Z',
          },
          {
            version: '2.6.2',
          },
          {
            version: '3.0.0-alpha',
            releaseTimestamp: '2014-09-23T03:11:33.430Z',
          },
          {
            version: '3.12.0',
            releaseTimestamp: '2019-05-15T00:24:28.390Z',
          },
        ],
        changelogContent:
          'This package includes the NUnit 3 framework assembly, which is referenced by your tests. You will need\n      to install version 3 of the nunit3-console program or a third-party runner that supports NUnit 3 in order to\n      execute tests. Runners intended for use with NUnit 2.x will not run NUnit 3 tests correctly.\n    ',
        sourceUrl: 'https://nunit.org/',
        registryUrl: 'https://myprivatefeed/index.json',
      });
    });

    it('processes real data (v3) nuspec fetch error', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, pkgListV3Registration)
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .replyWithError('unknown');
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.5.7.10213',
            releaseTimestamp: '2011-01-07T07:57:55.387Z',
          },
          {
            version: '2.6.0.12051',
            isDeprecated: true,
          },
          {
            version: '2.6.1',
            releaseTimestamp: '2012-08-05T03:08:28.403Z',
          },
          {
            version: '2.6.2',
            releaseTimestamp: '2012-10-23T15:37:48.000Z',
          },
          {
            version: '3.0.0-alpha',
            releaseTimestamp: '2014-09-23T03:11:33.430Z',
          },
          {
            version: '3.12.0',
            releaseTimestamp: '2019-05-15T00:24:28.390Z',
          },
        ],
        sourceUrl: 'https://nunit.org/',
        registryUrl: 'https://api.nuget.org/v3/index.json',
      });
    });

    it('processes real data (v3) nuspec fetch 404 error', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, pkgListV3Registration)
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .reply(404);
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.5.7.10213',
            releaseTimestamp: '2011-01-07T07:57:55.387Z',
          },
          {
            version: '2.6.0.12051',
            isDeprecated: true,
          },
          {
            version: '2.6.1',
            releaseTimestamp: '2012-08-05T03:08:28.403Z',
          },
          {
            version: '2.6.2',
            releaseTimestamp: '2012-10-23T15:37:48.000Z',
          },
          {
            version: '3.0.0-alpha',
            releaseTimestamp: '2014-09-23T03:11:33.430Z',
          },
          {
            version: '3.12.0',
            releaseTimestamp: '2019-05-15T00:24:28.390Z',
          },
        ],
        sourceUrl: 'https://nunit.org/',
        registryUrl: 'https://api.nuget.org/v3/index.json',
      });
    });

    it('processes real data (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.5.7.10213',
            releaseTimestamp: '2011-01-07T07:57:55.387Z',
          },
          {
            version: '2.6.0.12051',
          },
          {
            version: '2.6.2',
            releaseTimestamp: '2012-10-23T15:37:48.000Z',
          },
          {
            version: '2.7.1',
            releaseTimestamp: '2019-08-21T07:08:49.360Z',
          },
          {
            version: '3.0.0-alpha',
            releaseTimestamp: '2014-09-23T03:11:33.430Z',
          },
          {
            version: '3.12.0',
            releaseTimestamp: '2019-05-15T00:24:28.390Z',
          },
        ],
        tags: {
          latest: '3.12.0',
        },
        sourceUrl: 'https://nunit.org/',
        registryUrl: 'https://www.nuget.org/api/v2',
      });
    });

    it('processes real data no release (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2NoRelease);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).toBeNull();
    });

    it('processes real data without project url (v2)', async () => {
      const pkgListV2WithoutProjectUrl = codeBlock`
        <feed xml:base="https://www.nuget.org/api/v2" xmlns="http://www.w3.org/2005/Atom" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:georss="http://www.georss.org/georss" xmlns:gml="http://www.opengis.net/gml">
          <id>http://schemas.datacontract.org/2004/07/</id>
          <title/>
          <updated>2019-02-04T12:51:36Z</updated>
          <link rel="self" href="https://www.nuget.org/api/v2/Packages"/>
          <entry>
            <id>https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.11.0')</id>
            <category term="NuGetGallery.OData.V2FeedPackage" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme"/>
            <link rel="edit" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.11.0')"/>
            <link rel="self" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.11.0')"/>
            <title type="text">NUnit</title>
            <updated>2019-02-04T12:51:36Z</updated>
            <author>
              <name/>
            </author>
            <content type="application/zip" src="https://www.nuget.org/api/v2/package/NUnit/3.11.0"/>
            <m:properties>
              <d:Version>3.11.0</d:Version>
              <d:IsLatestVersion>true</d:IsLatestVersion>
            </m:properties>
          </entry>
          <entry>
            <id>https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='2.7.0')</id>
            <category term="NuGetGallery.OData.V2FeedPackage" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme"/>
            <link rel="edit" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='2.7.0')"/>
            <link rel="self" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='2.7.0')"/>
            <title type="text">NUnit</title>
            <updated>2019-02-04T12:51:36Z</updated>
            <author>
              <name/>
            </author>
            <content type="application/zip" src="https://www.nuget.org/api/v2/package/NUnit/2.7.0"/>
            <m:properties>
              <d:Version>2.7.0</d:Version>
              <d:IsLatestVersion>false</d:IsLatestVersion>
              <d:ProjectUrl>https://github.com/nunit/nunit-old</d:ProjectUrl>
            </m:properties>
          </entry>
          <entry>
            <id>https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.2.0')</id>
            <category term="NuGetGallery.OData.V2FeedPackage" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme"/>
            <link rel="edit" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.2.0')"/>
            <link rel="self" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.2.0')"/>
            <title type="text">NUnit</title>
            <updated>2019-02-04T12:51:36Z</updated>
            <author>
              <name/>
            </author>
            <content type="application/zip" src="https://www.nuget.org/api/v2/package/NUnit/3.2.0"/>
            <m:properties>
              <d:Version>3.2.0</d:Version>
            </m:properties>
          </entry>
          <entry>
            <id>https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.0.0-rc-2')</id>
            <category term="NuGetGallery.OData.V2FeedPackage" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme"/>
            <link rel="edit" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.0.0-rc-2')"/>
            <link rel="self" href="https://www.nuget.org/api/v2/Packages(Id='NUnit',Version='3.0.0-rc-2')"/>
            <title type="text">NUnit</title>
            <updated>2019-02-04T12:51:36Z</updated>
            <author>
              <name/>
            </author>
            <content type="application/zip" src="https://www.nuget.org/api/v2/package/NUnit/3.0.0-rc-2"/>
            <m:properties>
              <d:Version>3.0.0-rc-2</d:Version>
              <d:IsLatestVersion>false</d:IsLatestVersion>
              <d:ProjectUrl>https://github.com/nunit/nunit-old</d:ProjectUrl>
            </m:properties>
          </entry>
        </feed>
      `;
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2WithoutProjectUrl);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '2.7.0',
          },
          {
            version: '3.0.0-rc-2',
          },
          {
            version: '3.2.0',
          },
          {
            version: '3.11.0',
          },
        ],
        tags: {
          latest: '3.11.0',
        },
        registryUrl: 'https://www.nuget.org/api/v2',
      });
    });

    it('processes real data with no github project url (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2NoGitHubProjectUrl);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).toEqual({
        registryUrl: 'https://www.nuget.org/api/v2',
        releases: [
          {
            version: '3.11.0',
          },
        ],
        sourceUrl: 'https://nunit.org',
        tags: {
          latest: '3.11.0',
        },
      });
    });

    it('extracts latest tag (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2NoGitHubProjectUrl);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res?.tags?.latest).toBe('3.11.0');
    });

    it('handles paginated results (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2Page1of2)
        .get('/api/v2/PageTwo')
        .reply(200, pkgListV2Page2of2);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).toEqual({
        registryUrl: 'https://www.nuget.org/api/v2',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '2.0.0',
          },
        ],
        tags: {
          latest: '2.0.0',
        },
      });
    });

    // as this could lead to a Server-Side Request Forgery (SSRF), but could also be misconfiguration
    it('does not follow pagination to a different origin (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, Fixtures.get('nunit/v2_paginated_cross_origin.xml'));
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res?.releases).toEqual([{ version: '1.0.0' }]);
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        {
          feedUrl: 'https://www.nuget.org/api/v2',
          nextUrl: 'https://attacker.example.com/api/v2/steal',
        },
        'Ignoring cross-origin or invalid NuGet feed pagination link',
      );
    });

    it('follows cross-origin pagination when the datasource is opted in (v2)', async () => {
      vi.stubEnv('RENOVATE_X_NUGET_PAGINATION_ALLOW_CROSS_ORIGIN', 'true');
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, Fixtures.get('nunit/v2_paginated_cross_origin.xml'));
      httpMock
        .scope('https://attacker.example.com')
        .get('/api/v2/steal')
        .reply(200, pkgListV2Page2of2);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res?.releases).toEqual([
        { version: '1.0.0' },
        { version: '2.0.0' },
      ]);
      expect(logger.logger.once.warn).toHaveBeenCalledOnce();
    });

    it('should return deprecated', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/proxykit/index.json')
        .reply(200, pkgListV3Deprecated)
        .get('/v3-flatcontainer/proxykit/2.3.4/proxykit.nuspec')
        .reply(200, pkgInfoV3Deprecated);
      const res = await getPkgReleases({
        ...configV3Deprecated,
      });
      expect(res).toEqual({
        releases: [
          {
            version: '1.0.0',
            isDeprecated: true,
          },
          {
            version: '2.3.4',
            isDeprecated: true,
          },
        ],
        deprecationMessage: 'The package `ProxyKit` is deprecated.',
        changelogContent:
          'See https://github.com/ProxyKit/ProxyKit/releases for release notes.',
        sourceUrl: 'https://github.com/ProxyKit/ProxyKit',
        registryUrl: 'https://api.nuget.org/v3/index.json',
      });
    });
  });
});
