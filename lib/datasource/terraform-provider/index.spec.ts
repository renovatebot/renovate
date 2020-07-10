import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import { id as datasource, defaultRegistryUrls } from '.';

const consulData: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/azurerm-provider.json'
);
const hashicorpReleases: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/releaseBackendIndex.json'
);

const primaryUrl = defaultRegistryUrls[0];
const secondaryUrl = defaultRegistryUrls[1];

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
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, {});
      httpMock.scope(secondaryUrl).get('/index.json').reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(404);
      httpMock.scope(secondaryUrl).get('/index.json').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .replyWithError('');
      httpMock.scope(secondaryUrl).get('/index.json').replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, JSON.parse(consulData));
      const res = await getPkgReleases({
        datasource,
        depName: 'azurerm',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes data with alternative backend', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/google-beta')
        .reply(404, {
          errors: ['Not Found'],
        });
      httpMock
        .scope(secondaryUrl)
        .get('/index.json')
        .reply(200, JSON.parse(hashicorpReleases));

      const res = await getPkgReleases({
        datasource,
        depName: 'google-beta',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('simulate failing secondary release source', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/google-beta')
        .reply(404, {
          errors: ['Not Found'],
        });
      httpMock.scope(secondaryUrl).get('/index.json').reply(404);

      const res = await getPkgReleases({
        datasource,
        depName: 'datadog',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeNull();
    });
  });
});
