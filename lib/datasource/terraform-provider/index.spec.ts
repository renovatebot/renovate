import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { hashOfZipContent } from './hash';
import { createReleases, id as datasource, defaultRegistryUrls } from '.';

const consulData: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/azurerm-provider.json'
);
const hashicorpReleases: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/releaseBackendIndex.json'
);
const serviceDiscoveryResult: any = fs.readFileSync(
  'lib/datasource/terraform-module/__fixtures__/service-discovery.json'
);

const releaseBackend: any = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/releaseBackendFormatted.json'
);

const randomLinuxAmd64: Buffer = fs.readFileSync(
  'lib/datasource/terraform-provider/__fixtures__/test.zip'
);

const primaryUrl = defaultRegistryUrls[0];
const secondaryUrl = defaultRegistryUrls[1];

describe(getName(__filename), () => {
  jest.setTimeout(15000);

  describe('createReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });
    it('testing', async () => {
      httpMock
        .scope(secondaryUrl)
        .get('/index.json')
        .reply(200, releaseBackend)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_linux_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_linux_arm64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_windows_amd64.zip'
        )
        .reply(200, randomLinuxAmd64);

      const result = await createReleases(
        'azurerm',
        defaultRegistryUrls[1],
        'hashicorp/azurerm',
        ['2.53.0']
      );
      expect(result).not.toBeNull();
      expect(result).toBeArrayOfSize(1);
      expect(result[0].hashes).toBeArrayOfSize(3);
      expect(result[0].hashes).toEqual([
        { linux_amd64: 'h1:CgObCCvnD/qDmF6aOYQ2KvB2arDbcBURxARZfYB9Mvc=' },
        { linux_arm64: 'h1:CgObCCvnD/qDmF6aOYQ2KvB2arDbcBURxARZfYB9Mvc=' },
        { windows_amd64: 'h1:CgObCCvnD/qDmF6aOYQ2KvB2arDbcBURxARZfYB9Mvc=' },
      ]);
    });
  });
  describe('hashOfZipContent()', () => {
    it('full data', async () => {
      const result = await hashOfZipContent(
        'lib/datasource/terraform-provider/__fixtures__/test.zip',
        '/tmp/test'
      );
      expect(result).not.toBeNull();
      expect(result).toEqual('h1:CgObCCvnD/qDmF6aOYQ2KvB2arDbcBURxARZfYB9Mvc=');
    });
  });
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
      httpMock
        .scope(secondaryUrl)
        .get('/index.json')
        .reply(200, releaseBackend)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_linux_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_linux_arm64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_windows_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.52.0/terraform-provider-azurerm_2.52.0_linux_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.52.0/terraform-provider-azurerm_2.52.0_linux_arm64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.52.0/terraform-provider-azurerm_2.52.0_windows_amd64.zip'
        )
        .reply(200, randomLinuxAmd64);
      const res = await getPkgReleases({
        datasource,
        depName: 'azurerm',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('processes real data from lookupName, only return not all versions', async () => {
      httpMock
        .scope('https://registry.company.com')
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, JSON.parse(consulData))
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      httpMock
        .scope(secondaryUrl)
        .get('/index.json')
        .reply(200, releaseBackend)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_linux_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_linux_arm64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-azurerm/2.53.0/terraform-provider-azurerm_2.53.0_windows_amd64.zip'
        )
        .reply(200, randomLinuxAmd64);

      const res = await getPkgReleases({
        datasource,
        depName: 'azure',
        lookupName: 'hashicorp/azurerm',
        registryUrls: ['https://registry.company.com'],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
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
        .reply(200, JSON.parse(hashicorpReleases))
        .get(
          '/terraform-provider-google-beta/1.19.0/terraform-provider-google-beta_1.19.0_darwin_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/1.19.0/terraform-provider-google-beta_1.19.0_freebsd_386.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/1.19.0/terraform-provider-google-beta_1.19.0_freebsd_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/1.20.0/terraform-provider-google-beta_1.20.0_darwin_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/1.20.0/terraform-provider-google-beta_1.20.0_freebsd_386.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/1.20.0/terraform-provider-google-beta_1.20.0_freebsd_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/2.0.0/terraform-provider-google-beta_2.0.0_darwin_amd64.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/2.0.0/terraform-provider-google-beta_2.0.0_freebsd_386.zip'
        )
        .reply(200, randomLinuxAmd64)
        .get(
          '/terraform-provider-google-beta/2.0.0/terraform-provider-google-beta_2.0.0_freebsd_amd64.zip'
        )
        .reply(200, randomLinuxAmd64);

      const res = await getPkgReleases({
        datasource,
        depName: 'google-beta',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
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
