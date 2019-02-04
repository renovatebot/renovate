const fs = require('fs');
const got = require('../../lib/util/got');
const { getPkgReleases } = require('../../lib/datasource/hex');

let res1 = fs.readFileSync('test/_fixtures/hex/certifi.json', 'utf8');
res1 = JSON.parse(res1);

jest.mock('../../lib/util/got');

describe('datasource/hex', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({ res: {} });
      expect(
        await getPkgReleases({ lookupName: 'non_existent_package' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getPkgReleases({ lookupName: 'some_package' })).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases('some_package')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ lookupName: 'certifi' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
  });
});
