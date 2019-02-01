const fs = require('fs');
const got = require('../../lib/util/got');
const datasource = require('../../lib/datasource');

jest.mock('../../lib/util/got');

const pkgListV3 = fs.readFileSync('test/_fixtures/nuget/nunitV3.json', 'utf8');
const pkgListV2 = fs.readFileSync('test/_fixtures/nuget/nunitV2.json', 'utf8');

const pkgLatestV3 = fs.readFileSync(
  'test/_fixtures/nuget/latestV3.nuspec',
  'utf8'
);
const pkgLatestV2 = fs.readFileSync(
  'test/_fixtures/nuget/latestV2.json',
  'utf8'
);

const configV3V2 = {
  nugetFeeds: [
    {
      url: 'https://version3',
      version: 3,
    },
    {
      url: 'https://version2',
      version: 2,
    },
  ],
};

const configV2 = {
  nugetFeeds: [
    {
      url: 'https://version2',
      version: 2,
    },
  ],
};

const configV3 = {
  nugetFeeds: [
    {
      url: 'https://version3',
      version: 3,
    },
  ],
};

describe('datasource/nuget', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });

    it('returns null for empty result (v3v2)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases({
          ...configV3V2,
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });
    it('returns null for empty result (v2)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases({
          ...configV2,
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });
    it('returns null for empty result (v3)', async () => {
      got.mockReturnValueOnce({});
      expect(
        await datasource.getPkgReleases({
          ...configV3,
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });

    it('returns null for 404 (v3v2)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getPkgReleases({
          ...configV3V2,
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });
    it('returns null for 404 (v3)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getPkgReleases({
          ...configV3,
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });
    it('returns null for 404 (v3)', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getPkgReleases({
          ...configV2,
          purl: 'pkg:nuget/something',
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
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });
    it('returns null for unknown error (v3)', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases({
          ...configV3,
          purl: 'pkg:nuget/something',
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
          purl: 'pkg:nuget/something',
        })
      ).toBeNull();
    });

    it('processes real data (v3)', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV3),
      });
      got.mockReturnValueOnce({
        body: pkgLatestV3,
      });
      const res = await datasource.getPkgReleases({
        ...configV3,
        purl: 'pkg:nuget/nunit',
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
    it('processes real data (v2)', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(pkgListV2),
        statusCode: 200,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(pkgLatestV2),
        statusCode: 200,
      });
      const res = await datasource.getPkgReleases({
        ...configV2,
        purl: 'pkg:nuget/nunit',
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
  });
});
