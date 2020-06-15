import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import * as terraformProvider from '.';

const consulData: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/azurerm-provider.json'
);

const baseUrl = 'https://registry.terraform.io/';

describe('datasource/terraform', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, {});
      expect(
        await terraformProvider.getReleases({
          lookupName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/v1/providers/hashicorp/azurerm').reply(404);
      expect(
        await terraformProvider.getReleases({
          lookupName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .replyWithError('');
      expect(
        await terraformProvider.getReleases({
          lookupName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, JSON.parse(consulData));
      const res = await terraformProvider.getReleases({
        lookupName: 'azurerm',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
