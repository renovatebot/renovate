import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import * as _hostRules from '../../util/host-rules';
import * as nuget from '.';

const hostRules: any = _hostRules;

jest.mock('../../util/host-rules');

const pkgListV3 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV3.json',
  'utf8'
);
const pkgListV3WithoutProkjectUrl = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV3_withoutProjectUrl.json',
  'utf8'
);
const pkgListV3NoGitHubProjectUrl = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV3_noGitHubProjectUrl.json',
  'utf8'
);
const pkgListV3PrivateFeed = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV3_privateFeed.json',
  'utf8'
);
const pkgInfoV3FromNuget = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitv3_nuget-org.xml',
  'utf8'
);

const pkgListV2 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV2.xml',
  'utf8'
);
const pkgListV2NoGitHubProjectUrl = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV2_noGitHubProjectUrl.xml',
  'utf8'
);
const pkgListV2NoRelease = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV2_no_release.xml',
  'utf8'
);
const pkgListV2WithoutProjectUrl = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV2_withoutProjectUrl.xml',
  'utf8'
);

const pkgListV2Page1of2 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV2_paginated_1.xml',
  'utf8'
);
const pkgListV2Page2of2 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/nunitV2_paginated_2.xml',
  'utf8'
);

const nugetIndexV3 = fs.readFileSync(
  'lib/datasource/nuget/__fixtures__/indexV3.json',
  'utf8'
);

const configV3V2 = {
  lookupName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://www.nuget.org/api/v2/',
  ],
};

const configV2 = {
  lookupName: 'nunit',
  registryUrls: ['https://www.nuget.org/api/v2/'],
};

const configV3 = {
  lookupName: 'nunit',
  registryUrls: ['https://api.nuget.org/v3/index.json'],
};

const configV3NotNugetOrg = {
  lookupName: 'nunit',
  registryUrls: ['https://myprivatefeed/index.json'],
};

const configV3Multiple = {
  lookupName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://myprivatefeed/index.json',
  ],
};

describe('datasource/nuget', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it(`can't detect nuget feed version`, async () => {
      const config = {
        lookupName: 'nunit',
        registryUrls: ['#$#api.nuget.org/v3/index.xml'],
      };

      expect(
        await nuget.getReleases({
          ...config,
        })
      ).toBeNull();
    });

    it('extracts feed version from registry URL hash', async () => {
      httpMock.scope('https://my-registry').get('/').reply(200);
      const config = {
        lookupName: 'nunit',
        registryUrls: ['https://my-registry#protocolVersion=3'],
      };
      await nuget.getReleases({
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
        .reply(200, JSON.parse(nugetIndexV3));
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=PackageId:nunit&semVerLevel=2.0.0&prerelease=true')
        .reply(500);

      const res = await nuget.getReleases({
        ...configV3,
      });

      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it(`empty packages list (v3)`, async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3));
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=PackageId:nunit&semVerLevel=2.0.0&prerelease=true')
        .reply(200, JSON.parse('{"totalHits": 0}'));

      const res = await nuget.getReleases({
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
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, null);
      expect(
        await nuget.getReleases({
          ...configV3V2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty result (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, {});
      expect(
        await nuget.getReleases({
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
      const res = await nuget.getReleases({
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
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(500);
      expect(
        await nuget.getReleases({
          ...configV3V2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for non 200 (v3)', async () => {
      httpMock.scope('https://api.nuget.org').get('/v3/index.json').reply(500);
      expect(
        await nuget.getReleases({
          ...configV3,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for non 200 (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(500);
      expect(
        await nuget.getReleases({
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
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .replyWithError('');
      expect(
        await nuget.getReleases({
          ...configV3V2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns deduplicated results', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3))
        .get('/v3-flatcontainer/nunit/3.11.0/nunit.nuspec')
        .reply(200, pkgInfoV3FromNuget);
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=PackageId:nunit&semVerLevel=2.0.0&prerelease=true')
        .reply(200, JSON.parse(pkgListV3))
        .get('/query?q=nunit')
        .reply(200, JSON.parse(pkgListV3PrivateFeed));
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .reply(200, JSON.parse(nugetIndexV3));

      const res = await nuget.getReleases({
        ...configV3Multiple,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(30);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error in getReleasesFromV3Feed (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .replyWithError('');
      expect(
        await nuget.getReleases({
          ...configV3,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error in getQueryUrlForV3Feed  (v3)', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3));
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=PackageId:nunit&semVerLevel=2.0.0&prerelease=true')
        .replyWithError('');
      expect(
        await nuget.getReleases({
          ...configV3,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .replyWithError('');
      expect(
        await nuget.getReleases({
          ...configV2,
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v3) feed is a nuget.org', async () => {
      httpMock
        .scope('https://api.nuget.org')
        .get('/v3/index.json')
        .reply(200, JSON.parse(nugetIndexV3))
        .get('/v3-flatcontainer/nunit/3.11.0/nunit.nuspec')
        .reply(200, pkgInfoV3FromNuget);
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=PackageId:nunit&semVerLevel=2.0.0&prerelease=true')
        .reply(200, JSON.parse(pkgListV3));
      const res = await nuget.getReleases({
        ...configV3,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v3) feed is not a nuget.org', async () => {
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=nunit')
        .reply(200, JSON.parse(pkgListV3));
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .reply(200, JSON.parse(nugetIndexV3));

      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v3) feed is not a nuget.org with mismatch', async () => {
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=nun')
        .reply(200, JSON.parse(pkgListV3));
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .reply(200, JSON.parse(nugetIndexV3));
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
        lookupName: 'nun',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data without project url (v3)', async () => {
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=nunit')
        .reply(200, JSON.parse(pkgListV3WithoutProkjectUrl));
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .reply(200, JSON.parse(nugetIndexV3));
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).not.toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data with no github project url (v3)', async () => {
      httpMock
        .scope('https://api-v2v3search-0.nuget.org')
        .get('/query?q=nunit')
        .reply(200, JSON.parse(pkgListV3NoGitHubProjectUrl));
      httpMock
        .scope('https://myprivatefeed')
        .get('/index.json')
        .reply(200, JSON.parse(nugetIndexV3));
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, pkgListV2);
      const res = await nuget.getReleases({
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
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, pkgListV2NoRelease);
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data without project url (v2)', async () => {
      httpMock
        .scope('https://www.nuget.org')
        .get(
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, pkgListV2WithoutProjectUrl);
      const res = await nuget.getReleases({
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
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, pkgListV2NoGitHubProjectUrl);
      const res = await nuget.getReleases({
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
          '/api/v2//FindPackagesById()?id=%27nunit%27&$select=Version,IsLatestVersion,ProjectUrl'
        )
        .reply(200, pkgListV2Page1of2);
      httpMock
        .scope('https://example.org')
        .get('/')
        .reply(200, pkgListV2Page2of2);
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
