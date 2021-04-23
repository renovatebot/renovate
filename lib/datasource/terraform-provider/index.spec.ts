import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { id as datasource, defaultRegistryUrls } from '.';

const consulData: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/azurerm-provider.json'
);
const hashicorpReleases: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/releaseBackendIndex.json'
);
const serviceDiscoveryResult: any = fs.readFileSync(
  'lib/datasource/terraform-module/__fixtures__/service-discovery.json'
);

const primaryUrl = defaultRegistryUrls[0];
const secondaryUrl = defaultRegistryUrls[1];

describe(getName(__filename), () => {
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
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
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
        .reply(404)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
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
        .replyWithError('')
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
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
        .reply(200, JSON.parse(consulData))
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        depName: 'azurerm',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('processes real data from lookupName', async () => {
      httpMock
        .scope('https://registry.company.com')
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, JSON.parse(consulData))
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        depName: 'azure',
        lookupName: 'hashicorp/azurerm',
        registryUrls: ['https://registry.company.com'],
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
        })
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
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
        })
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      httpMock.scope(secondaryUrl).get('/index.json').reply(404);

      const res = await getPkgReleases({
        datasource,
        depName: 'datadog',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeNull();
    });
    it('returns null for error in service discovery', async () => {
      httpMock.scope(primaryUrl).get('/.well-known/terraform.json').reply(404);
      httpMock.scope(secondaryUrl).get('/index.json').replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
