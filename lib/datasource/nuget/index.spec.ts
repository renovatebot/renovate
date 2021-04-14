import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { id as versioning } from '../../versioning/nuget';
import { id as datasource, parseRegistryUrl } from '.';

const hostRules: any = _hostRules;

jest.mock('../../util/host-rules');

const pkgInfoV3FromNuget = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v3_nuget_org.xml',
  'utf8'
);
const pkgListV3Registration = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v3_registration.json',
  'utf8'
);

const pkgListV2 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v2.xml',
  'utf8'
);
const pkgListV2NoGitHubProjectUrl = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v2_noGitHubProjectUrl.xml',
  'utf8'
);
const pkgListV2NoRelease = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v2_no_release.xml',
  'utf8'
);
const pkgListV2WithoutProjectUrl = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v2_withoutProjectUrl.xml',
  'utf8'
);

const pkgListV2Page1of2 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v2_paginated_1.xml',
  'utf8'
);
const pkgListV2Page2of2 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunit/v2_paginated_2.xml',
  'utf8'
);

const nugetIndexV3 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/v3_index.json',
  'utf8'
);

const nlogMocks = [
  {
    url: '/v3/registration5-gz-semver2/nlog/index.json',
    result: fs.readFileSync(
      'lib/datasource/nuget/__fixtures__/nlog/v3_registration.json',
      'utf8'
    ),
  },
  {
    url: '/v3/registration5-gz-semver2/nlog/page/1.0.0.505/4.4.0-beta5.json',
    result: fs.readFileSync(
      'lib/datasource/nuget/__fixtures__/nlog/v3_catalog_1.json',
      'utf8'
    ),
  },
  {
    url: '/v3/registration5-gz-semver2/nlog/page/4.4.0-beta6/4.6.0-rc2.json',
    result: fs.readFileSync(
      'lib/datasource/nuget/__fixtures__/nlog/v3_catalog_2.json',
      'utf8'
    ),
  },
  {
    url: '/v3/registration5-gz-semver2/nlog/page/4.6.0-rc3/5.0.0-beta11.json',
    result: fs.readFileSync(
      'lib/datasource/nuget/__fixtures__/nlog/v3_catalog_3.json',
      'utf8'
    ),
  },
  {
    url: '/v3-flatcontainer/nlog/4.7.3/nlog.nuspec',
    result: fs.readFileSync(
      'lib/datasource/nuget/__fixtures__/nlog/nuspec.xml',
      'utf8'
    ),
  },
];

const configV3V2 = {
  datasource,
  versioning,
  depName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://www.nuget.org/api/v2/',
  ],
};

const configV2 = {
  datasource,
  versioning,
  depName: 'nunit',
  registryUrls: ['https://www.nuget.org/api/v2/'],
};

const configV3 = {
  datasource,
  versioning,
  depName: 'nunit',
  registryUrls: ['https://api.nuget.org/v3/index.json'],
};

const configV3NotNugetOrg = {
  datasource,
  versioning,
  depName: 'nunit',
  registryUrls: ['https://myprivatefeed/index.json'],
};

const configV3Multiple = {
  datasource,
  versioning,
  depName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://myprivatefeed/index.json',
  ],
};

describe(getName(__filename), () => {
  describe('parseRegistryUrl', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('extracts feed version from registry URL hash (v3)', () => {
      const parsed = parseRegistryUrl('https://my-registry#protocolVersion=3');

      expect(parsed.feedUrl).toEqual('https://my-registry/');
      expect(parsed.protocolVersion).toEqual(3);
    });

    it('extracts feed version from registry URL hash (v2)', () => {
      const parsed = parseRegistryUrl('https://my-registry#protocolVersion=2');

      expect(parsed.feedUrl).toEqual('https://my-registry/');
      expect(parsed.protocolVersion).toEqual(2);
    });

    it('defaults to v2', () => {
      const parsed = parseRegistryUrl('https://my-registry');

      expect(parsed.feedUrl).toEqual('https://my-registry/');
      expect(parsed.protocolVersion).toEqual(2);
    });

    it('returns null for unparseable', () => {
      const parsed = parseRegistryUrl(
        'https://test:malfor%5Med@test.example.com'
      );

      expect(parsed.feedUrl).toEqual(
        'https://test:malfor%5Med@test.example.com'
      );
      expect(parsed.protocolVersion).toBeNull();
    });
  });

  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts.mockReturnValue([]);
      hostRules.find.mockReturnValue({});
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it(`can't detect nuget feed version`, async () => {
      const config = {
        datasource,
        versioning,
        depName: 'nunit',
        registryUrls: ['#$#api.nuget.org/v3/index.xml'],
      };

      expect(
        await getPkgReleases({
          ...config,
        })
      ).toBeNull();
    });

    it('extracts feed version from registry URL hash', async () => {
      httpMock.scope('https://my-registry').get('/').reply(200);
      const config = {
        datasource,
        versioning,
        depName: 'nunit',
        registryUrls: ['https://my-registry#protocolVersion=3'],
      };
      await getPkgReleases({
        ...config,
      });
      const trace = httpMock.getTrace();
      expect(trace[0].url).toEqual('https://my-registry/');
      expect(trace).toMatchSnapshot();
    });

    it(`can't get packages list (v3)`, async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3))
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(500);

      const res = await getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it(`empty packages list (v3)`, async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3))
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, {});

      const res = await getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for empty result (v3v2)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, {});
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(200, null);
      expect(
        await getPkgReleases({
          ...configV3V2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty result (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(200, {});
      expect(
        await getPkgReleases({
          ...configV2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for non 200 (v3v2)', async () => {
      httpMock.scope('https://api.nuget.org').get('/v3/index.json').reply(500);
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(500);
      expect(
        await getPkgReleases({
          ...configV3V2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for non 200 (v3)', async () => {
      httpMock.scope('https://api.nuget.org').get('/v3/index.json').reply(500);
      expect(
        await getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for non 200 (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(500);
      expect(
        await getPkgReleases({
          ...configV2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for unknown error (v3v2)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .replyWithError('');
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV3V2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns deduplicated results', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, JSON.parse(nugetIndexV3))
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
        .reply(200, JSON.parse(nugetIndexV3));

      const res = await getPkgReleases({
        ...configV3Multiple,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(45);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error in getReleasesFromV3Feed (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error in getQueryUrlForV3Feed  (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3))
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .replyWithError('');
      expect(
        await getPkgReleases({
          ...configV2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v3) feed is a nuget.org', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, JSON.parse(nugetIndexV3))
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(200, pkgListV3Registration)
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .reply(200, pkgInfoV3FromNuget);
      const res = await getPkgReleases({
        ...configV3,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v3) for several catalog pages', async () => {
      const scope = httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .twice()
        .reply(200, JSON.parse(nugetIndexV3));
      nlogMocks.forEach(({ url, result }) => {
        scope.get(url).reply(200, result);
      });
      const res = await getPkgReleases({
        ...configV3,
        depName: 'nlog',
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v3) feed is not a nuget.org', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/registration5-gz-semver2/nunit/index.json')
        .reply(
          200,
          pkgListV3Registration
            .replace(/"http:\/\/nunit\.org"/g, '""')
            .replace('"published": "2012-10-23T15:37:48+00:00",', '')
        )
        .get('/v3-flatcontainer/nunit/3.12.0/nunit.nuspec')
        .reply(
          200,
          pkgInfoV3FromNuget.replace('https://github.com/nunit/nunit', '')
        );
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .twice()
        .reply(200, JSON.parse(nugetIndexV3));

      const res = await getPkgReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(200, pkgListV2);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data no relase (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(200, pkgListV2NoRelease);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data without project url (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(200, pkgListV2WithoutProjectUrl);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).not.toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data with no github project url (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
        )
        .reply(200, pkgListV2NoGitHubProjectUrl);
      const res = await getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles paginated results (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2/FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl,Published'
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
