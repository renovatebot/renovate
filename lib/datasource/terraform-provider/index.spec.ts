import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';
import { TerraformProviderDatasource } from '.';

const consulData: any = loadFixture('azurerm-provider.json');
const hashicorpReleases: any = loadFixture('releaseBackendIndex.json');
const serviceDiscoveryResult: any = loadFixture('service-discovery.json');

const terraformProviderDatasource = new TerraformProviderDatasource();
const primaryUrl = terraformProviderDatasource.defaultRegistryUrls[0];
const secondaryUrl = terraformProviderDatasource.defaultRegistryUrls[1];

describe(getName(), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
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
          datasource: TerraformProviderDatasource.id,
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
          datasource: TerraformProviderDatasource.id,
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
          datasource: TerraformProviderDatasource.id,
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
        datasource: TerraformProviderDatasource.id,
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
        datasource: TerraformProviderDatasource.id,
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
        datasource: TerraformProviderDatasource.id,
        depName: 'google-beta',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('simulate failing secondary release source', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/datadog')
        .reply(404, {
          errors: ['Not Found'],
        })
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      httpMock.scope(secondaryUrl).get('/index.json').reply(404);

      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        depName: 'datadog',
      });
      expect(res).toMatchSnapshot();
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for error in service discovery', async () => {
      httpMock.scope(primaryUrl).get('/.well-known/terraform.json').reply(404);
      httpMock.scope(secondaryUrl).get('/index.json').replyWithError('');
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          depName: 'azurerm',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
