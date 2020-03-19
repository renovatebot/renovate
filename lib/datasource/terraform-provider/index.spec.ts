import fs from 'fs';
import _got from '../../util/got';
import * as terraformProvider from '.';

jest.mock('../../util/got');

const got: any = _got;

const consulData: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/azurerm-provider.json'
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
        await terraformProvider.getPkgReleases({
          lookupName: 'azurerm',
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
        await terraformProvider.getPkgReleases({
          lookupName: 'azurerm',
        })
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await terraformProvider.getPkgReleases({
          lookupName: 'azurerm',
        })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(consulData),
      });
      const res = await terraformProvider.getPkgReleases({
        lookupName: 'azurerm',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
  });
});
