import fs from 'fs';
import _got from '../../lib/util/got';
import * as datasource from '../../lib/datasource';

jest.mock('../../lib/util/got');

const got: any = _got;

const consulData: any = fs.readFileSync(
  'test/datasource/terraform/_fixtures/registry-consul.json'
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
        await datasource.getPkgReleases({
          datasource: 'terraform',
          lookupName: 'hashicorp/consul/aws',
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getPkgReleases({
          datasource: 'terraform',
          lookupName: 'hashicorp/consul/aws',
        })
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getPkgReleases({
          datasource: 'terraform',
          lookupName: 'hashicorp/consul/aws',
        })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res = await datasource.getPkgReleases({
        datasource: 'terraform',
        lookupName: 'hashicorp/consul/aws',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
    it('processes with registry in name', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res = await datasource.getPkgReleases({
        datasource: 'terraform',
        lookupName: 'registry.terraform.io/hashicorp/consul/aws',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
    it('rejects mismatch', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res = await datasource.getPkgReleases({
        datasource: 'terraform',
        lookupName: 'consul/foo',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toBeNull();
    });
  });
});
