const fs = require('fs');
const got = require('got');
const datasource = require('../../lib/datasource');

jest.mock('got');

const consulData = fs.readFileSync(
  'test/_fixtures/terraform/registry-consul.json'
);

describe('datasource/terraform', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      expect(
        await datasource.getPkgReleases('pkg:terraform/hashicorp/consul/aws')
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getPkgReleases('pkg:terraform/hashicorp/consul/aws')
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases('pkg:terraform/hashicorp/consul/aws')
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res = await datasource.getPkgReleases(
        'pkg:terraform/hashicorp/consul/aws'
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
    it('rejects mismatch', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res = await datasource.getPkgReleases(
        'pkg:terraform/consul/foo?registry=hashicorp'
      );
      expect(res).toBeNull();
    });
  });
});
