const fs = require('fs');
const got = require('got');
const datasource = require('../../lib/datasource');

jest.mock('got');

const res1 = fs.readFileSync('test/_fixtures/nuget/nunit.json', 'utf8');
const res2 = fs.readFileSync('test/_fixtures/nuget/sample.nuspec', 'utf8');

describe('datasource/nuget', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({});
      expect(await datasource.getPkgReleases('pkg:nuget/something')).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await datasource.getPkgReleases('pkg:nuget/something')).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await datasource.getPkgReleases('pkg:nuget/something')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      got.mockReturnValueOnce({
        body: res2,
      });
      const res = await datasource.getPkgReleases('pkg:nuget/nunit');
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(res.sourceUrl).toBeDefined();
    });
  });
});
