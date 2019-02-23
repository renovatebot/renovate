const fs = require('fs');
const got = require('../../lib/util/got');
const datasource = require('../../lib/datasource');
const hostRules = require('../../lib/util/host-rules');

jest.mock('../../lib/util/got');
jest.mock('../../lib/util/host-rules');

const pkgListV3 = fs.readFileSync('test/_fixtures/nuget/nunitV3.json', 'utf8');
const pkgListV3WithoutProkjectUrl = fs.readFileSync(
  'test/_fixtures/nuget/nunitV3_withoutProjectUrl.json',
  'utf8'
);
const pkgInfoV3FromNuget = fs.readFileSync(
  'test/_fixtures/nuget/nunitv3_nuget-org.xml',
  'utf8'
);

const pkgListV2 = fs.readFileSync('test/_fixtures/nuget/nunitV2.xml', 'utf8');
const pkgListV2WithoutProjectUrl = fs.readFileSync(
  'test/_fixtures/nuget/nunitV2_withoutProjectUrl.xml',
  'utf8'
);

const nugetIndexV3 = fs.readFileSync(
  'test/_fixtures/nuget/indexV3.json',
  'utf8'
);

const configNoRegistryUrls = {
  datasource: 'nuget',
  lookupName: 'nunit',
};

const configV3V2 = {
  datasource: 'nuget',
  lookupName: 'nunit',
  registryUrls: [
    'https://api.nuget.org/v3/index.json',
    'https://www.nuget.org/api/v2/',
  ],
};

const configV2 = {
  datasource: 'nuget',
  lookupName: 'nunit',
  registryUrls: ['https://www.nuget.org/api/v2/'],
};

const configV3 = {
  datasource: 'nuget',
  lookupName: 'nunit',
  registryUrls: ['https://api.nuget.org/v3/index.json'],
};

const configV3NotNugetOrg = {
  datasource: 'nuget',
  lookupName: 'nunit',
  registryUrls: ['https://myprivatefeed/index.json'],
};

describe('datasource/nuget', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      global.repoCache = {};
    });

    it(`can't detect nuget feed version`, async () => {
      const config = {
        datasource: 'nuget',
        lookupName: 'nunit',
        registryUrls: ['#$#api.nuget.org/v3/index.xml'],
      };

      expect(
        await datasource.getPkgReleases({
          ...config,
        })
      ).toBeNull();
    });

    it('supports basic authentication', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse('{"totalHits": 0}'),
        statusCode: 200,
      });

      hostRules.find.mockReturnValue({
        username: 'some-username',
        password: 'some-password',
      });

      await datasource.getPkgReleases({
        ...configV3,
      });

      expect(got.mock.calls[0][1].headers.Authorization).toBe(
        'Basic c29tZS11c2VybmFtZTpzb21lLXBhc3N3b3Jk'
      );
    });

    it('queries the default nuget feed if no registries are supplied', async () => {
      await datasource.getPkgReleases({
        ...configNoRegistryUrls,
      });
      expect(got.mock.calls[0][0]).toEqual(
        'https://api.nuget.org/v3/index.json'
      );
    });

    it(`can't get packages list (v3)`, async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        statusCode: 500,
      });
      const res = await datasource.getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
    });
    it(`empty packages list (v3)`, async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse('{"totalHits": 0}'),
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV3,
      });

      expect(res).toBeNull();
    });

    it('returns null for empty result (v3v2)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases({
          ...configV3V2,
        })
      ).toBeNull();
    });
    it('returns null for empty result (v2)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases({
          ...configV2,
        })
      ).toBeNull();
    });
    it('returns null for empty result (v3)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
    });

    it('returns null for non 200 (v3v2)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      expect(
        await datasource.getPkgReleases({
          ...configV3V2,
        })
      ).toBeNull();
    });
    it('returns null for non 200 (v3)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      expect(
        await datasource.getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
    });
    it('returns null for non 200 (v3)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      expect(
        await datasource.getPkgReleases({
          ...configV2,
        })
      ).toBeNull();
    });

    it('returns null for unknown error (v3v2)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases({
          ...configV3V2,
        })
      ).toBeNull();
    });
    it('returns null for unknown error in getPkgReleasesFromV3Feed (v3)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
    });
    it('returns null for unknown error in getQueryUrlForV3Feed  (v3)', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases({
          ...configV3,
        })
      ).toBeNull();
    });
    it('returns null for unknown error (v2)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases({
          ...configV2,
        })
      ).toBeNull();
    });

    it('processes real data (v3) feed is a nuget.org', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: pkgInfoV3FromNuget,
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV3,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data (v3) feed is not a nuget.org', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV3),
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data without project url (v3)', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV3WithoutProkjectUrl),
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).not.toBeDefined();
    });
    it('processes real data (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2,
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data without project url (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2WithoutProjectUrl,
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).not.toBeDefined();
    });
  });
});
