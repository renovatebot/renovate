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
    it('returns from cache', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res1 = await datasource.getPkgReleases(
        'pkg:terraform/hashicorp/consul/aws'
      );
      const res2 = await datasource.getPkgReleases(
        'pkg:terraform/hashicorp/consul/aws'
      );
      expect(res1).toEqual(res2);
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
