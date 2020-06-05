import fs from 'fs';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import * as nuget from '.';

const hostRules: any = _hostRules;

jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const got: any = _got;

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
      const config = {
        lookupName: 'nunit',
        registryUrls: ['https://my-registry#protocolVersion=3'],
      };
      await nuget.getReleases({
        ...config,
      });
      expect(got.mock.calls[0][0]).toEqual('https://my-registry/');
    });

    it(`can't get packages list (v3)`, async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        statusCode: 500,
      });
      const res = await nuget.getReleases({
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
      const res = await nuget.getReleases({
        ...configV3,
      });

      expect(res).toBeNull();
    });

    it('returns null for empty result (v3v2)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await nuget.getReleases({
          ...configV3V2,
        })
      ).toBeNull();
    });
    it('returns null for empty result (v2)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await nuget.getReleases({
          ...configV2,
        })
      ).toBeNull();
    });
    it('returns null for empty result (v3)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await nuget.getReleases({
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
        await nuget.getReleases({
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
        await nuget.getReleases({
          ...configV3,
        })
      ).toBeNull();
    });
    it('returns null for non 200 (v2)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      expect(
        await nuget.getReleases({
          ...configV2,
        })
      ).toBeNull();
    });

    it('returns null for unknown error (v3v2)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await nuget.getReleases({
          ...configV3V2,
        })
      ).toBeNull();
    });
    it('returns deduplicated results', async () => {
      got
        .mockReturnValueOnce({
          body: JSON.parse(nugetIndexV3),
          statusCode: 200,
        })
        .mockReturnValueOnce({
          body: JSON.parse(pkgListV3),
          statusCode: 200,
        })
        .mockReturnValueOnce({
          body: pkgInfoV3FromNuget,
          statusCode: 200,
        })
        .mockReturnValueOnce({
          body: JSON.parse(nugetIndexV3),
          statusCode: 200,
        })
        .mockReturnValueOnce({
          body: JSON.parse(pkgListV3PrivateFeed),
          statusCode: 200,
        })
        .mockReturnValueOnce({
          body: pkgInfoV3FromNuget,
          statusCode: 200,
        });
      const res = await nuget.getReleases({
        ...configV3Multiple,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(30);
    });
    it('returns null for unknown error in getReleasesFromV3Feed (v3)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await nuget.getReleases({
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
        await nuget.getReleases({
          ...configV3,
        })
      ).toBeNull();
    });
    it('returns null for unknown error (v2)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await nuget.getReleases({
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
      const res = await nuget.getReleases({
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
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data (v3) feed is not a nuget.org with mismatch', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV3),
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
        lookupName: 'nun',
      });
      expect(res).toBeNull();
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
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).not.toBeDefined();
    });
    it('processes real data with no github project url (v3)', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(nugetIndexV3),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV3NoGitHubProjectUrl),
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV3NotNugetOrg,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('processes real data (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2,
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data no relase (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2NoRelease,
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).toBeNull();
    });
    it('processes real data without project url (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2WithoutProjectUrl,
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).not.toBeDefined();
    });
    it('processes real data with no github project url (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2NoGitHubProjectUrl,
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('handles paginated results (v2)', async () => {
      got.mockReturnValueOnce({
        body: pkgListV2Page1of2,
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: pkgListV2Page2of2,
        statusCode: 200,
      });
      const res = await nuget.getReleases({
        ...configV2,
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
  });
});
