import { Readable } from 'stream';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { getPkgReleases } from '..';
import { GlobalConfig } from '../../../config/global';
import * as _packageCache from '../../../util/cache/package';
import { id as versioning } from '../../versioning/nuget';
import { parseRegistryUrl } from './common';
import { NugetDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { hostRules, logger } from '~test/util';

const datasource = NugetDatasource.id;

vi.mock('../../../util/host-rules', () => mockDeep());
vi.mock('../../../util/cache/package', () => mockDeep());

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
const pkgListV2WithoutProjectUrl = Fixtures.get(
  'nunit/v2_withoutProjectUrl.xml',
);

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
    beforeEach(() => {
      hostRules.hosts.mockReturnValue([]);
      hostRules.find.mockReturnValue({});
    });

    it(`can't detect nuget feed version`, async () => {
      const config = {
        datasource,
        versioning,
        packageName: 'nunit',
        registryUrls: ['#$#api.nuget.org/v3/index.xml'],
      };

      expect(
        await getPkgReleases({
          ...config,
        }),
      ).toBeNull();
    });

    it('extracts feed version from registry URL hash', async () => {
      httpMock.scope('https://my-registry').get('/').reply(200);
      const config = {
        datasource,
        versioning,
        packageName: 'nunit',
        registryUrls: ['https://my-registry#protocolVersion=3'],
      };
      expect(
        await getPkgReleases({
          ...config,
        }),
      ).toBeNull();
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
      expect(
        await getPkgReleases({
          ...configV3V2,
        }),
      ).toBeNull();
    });

    it('returns null for empty result (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, {});
      expect(
        await getPkgReleases({
          ...configV2,
        }),
      ).toBeNull();
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
          servicesIndexRaw: JSON.parse(nugetIndex),
        },
        'no PackageBaseAddress services found',
      );
    });

    describe('determine source URL from nupkg', () => {
      beforeEach(() => {
        GlobalConfig.set({
          cacheDir: upath.join('/tmp/cache'),
        });
        process.env.RENOVATE_X_NUGET_DOWNLOAD_NUPKGS = 'true';
      });

      afterEach(() => {
        delete process.env.RENOVATE_X_NUGET_DOWNLOAD_NUPKGS;
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
        expect(packageCache.setWithRawTtl).toHaveBeenCalledWith(
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
        expect(packageCache.setWithRawTtl).toHaveBeenCalledWith(
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
      expect(
        await getPkgReleases({
          ...configV3V2,
        }),
      ).toBeNull();
    });

    it('returns null for non 200 (v3)', async () => {
      httpMock.scope('https://api.nuget.org').get('/v3/index.json').reply(500);
      expect(
        await getPkgReleases({
          ...configV3,
        }),
      ).toBeNull();
    });

    it('returns null for non 200 (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(500);
      expect(
        await getPkgReleases({
          ...configV2,
        }),
      ).toBeNull();
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
      expect(
        await getPkgReleases({
          ...configV3V2,
        }),
      ).toBeNull();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(45);
    });

    it('returns null for unknown error in getReleasesFromV3Feed (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV3,
        }),
      ).toBeNull();
    });

    it('returns null for unknown error in getQueryUrlForV3Feed  (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, nugetIndexV3)
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV3,
        }),
      ).toBeNull();
    });

    it('returns null for unknown error (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV2,
        }),
      ).toBeNull();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeDefined();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeDefined();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeDefined();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeDefined();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeDefined();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeDefined();
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
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published',
        )
        .reply(200, pkgListV2WithoutProjectUrl);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res?.sourceUrl).toBeUndefined();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
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
        .reply(200, pkgListV2Page1of2);
      httpMock
        .scope('https://example.org')
        .get('/')
        .reply(200, pkgListV2Page2of2);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
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
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
  });
});
