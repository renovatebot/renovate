import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { TerraformProviderDatasource } from '.';

const azurermData = Fixtures.get('azurerm-provider.json');
const azurermVersionsData = Fixtures.get('azurerm-provider-versions.json');
const hashicorpGoogleBetaReleases = Fixtures.get(
  'releaseBackendIndexGoogleBeta.json',
);
const serviceDiscoveryResult = Fixtures.get('service-discovery.json');
const telmateProxmoxVersions = Fixtures.get(
  'telmate-proxmox-versions-response.json',
);

const terraformProviderDatasource = new TerraformProviderDatasource();
const primaryUrl = terraformProviderDatasource.defaultRegistryUrls[0];
const secondaryUrl = terraformProviderDatasource.defaultRegistryUrls[1];

describe('modules/datasource/terraform-provider/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/index.json')
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(404)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/index.json')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
        }),
      ).toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .replyWithError('')
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/index.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm')
        .reply(200, azurermData)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        packageName: 'azurerm',
      });
      expect(res).toEqual({
        homepage: 'https://registry.terraform.io/providers/hashicorp/azurerm',
        registryUrl: 'https://registry.terraform.io',
        releases: [
          {
            version: '2.52.0',
          },
          {
            releaseTimestamp: '2019-11-26T08:22:56.000Z',
            version: '2.53.0',
          },
        ],
        sourceUrl:
          'https://github.com/terraform-providers/terraform-provider-azurerm',
      });
    });

    it('returns null for empty result from third party', async () => {
      httpMock
        .scope('https://registry.company.com')
        .get('/v1/providers/hashicorp/azurerm/versions')
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
          registryUrls: ['https://registry.company.com'],
        }),
      ).toBeNull();
    });

    it('returns null for 404 from third party', async () => {
      httpMock
        .scope('https://registry.company.com')
        .get('/v1/providers/hashicorp/azurerm/versions')
        .reply(404)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
          registryUrls: ['https://registry.company.com'],
        }),
      ).toBeNull();
    });

    it('returns null for unknown error from third party', async () => {
      httpMock
        .scope('https://registry.company.com')
        .get('/v1/providers/hashicorp/azurerm/versions')
        .replyWithError('')
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
          registryUrls: ['https://registry.company.com'],
        }),
      ).toBeNull();
    });

    it('processes real data from third party', async () => {
      httpMock
        .scope('https://registry.company.com')
        .get('/v1/providers/hashicorp/azurerm/versions')
        .reply(200, azurermVersionsData)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        packageName: 'hashicorp/azurerm',
        registryUrls: ['https://registry.company.com'],
      });
      expect(res).toEqual({
        registryUrl: 'https://registry.company.com',
        releases: [
          {
            version: '2.49.0',
          },
          {
            version: '3.0.0',
          },
          {
            version: '3.0.1',
          },
        ],
      });
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
        .get('/terraform-provider-google-beta/index.json')
        .reply(200, hashicorpGoogleBetaReleases);

      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        packageName: 'google-beta',
      });
      expect(res).toEqual({
        registryUrl: 'https://releases.hashicorp.com',
        releases: [
          {
            version: '1.19.0',
          },
          {
            version: '1.20.0',
          },
          {
            version: '2.0.0',
          },
        ],
        sourceUrl:
          'https://github.com/terraform-providers/terraform-provider-google-beta',
      });
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
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-datadog/index.json')
        .reply(404);

      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        packageName: 'datadog',
      });
      expect(res).toBeNull();
    });

    it('returns null for error in service discovery', async () => {
      httpMock.scope(primaryUrl).get('/.well-known/terraform.json').reply(404);
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/index.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'azurerm',
        }),
      ).toBeNull();
    });
  });

  describe('getBuilds', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm/versions')
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);

      const result = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'hashicorp/azurerm',
        '2.50.0',
      );
      expect(result).toBeNull();
    });

    it('returns null for non hashicorp dependency and releases.hashicorp.com registryUrl', async () => {
      const result = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[1],
        'test/azurerm',
        '2.50.0',
      );
      expect(result).toBeNull();
    });

    it('returns null if a version is requested which is not available', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/Telmate/proxmox/versions')
        .reply(200, telmateProxmoxVersions)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const result = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'Telmate/proxmox',
        '2.8.0',
      );
      expect(result).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/Telmate/proxmox/versions')
        .reply(200, telmateProxmoxVersions)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/darwin/arm64')
        .reply(200, {
          os: 'darwin',
          arch: 'arm64',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        })
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/linux/amd64')
        .reply(200, {
          os: 'linux',
          arch: 'amd64',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        })
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/linux/arm')
        .reply(200, {
          os: 'linux',
          arch: 'arm',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        })
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/windows/amd64')
        .reply(200, {
          os: 'windows',
          arch: 'amd64',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        });
      const res = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'Telmate/proxmox',
        '2.6.1',
      );
      expect(res).toEqual([
        {
          arch: 'arm64',
          download_url: 'https://downloads.example.com/proxmox',
          filename: 'aFileName.zip',
          name: 'Telmate/proxmox',
          os: 'darwin',
          url: 'https://downloads.example.com/proxmox',
          version: '2.6.1',
        },
        {
          arch: 'amd64',
          download_url: 'https://downloads.example.com/proxmox',
          filename: 'aFileName.zip',
          name: 'Telmate/proxmox',
          os: 'linux',
          url: 'https://downloads.example.com/proxmox',
          version: '2.6.1',
        },
        {
          arch: 'arm',
          download_url: 'https://downloads.example.com/proxmox',
          filename: 'aFileName.zip',
          name: 'Telmate/proxmox',
          os: 'linux',
          url: 'https://downloads.example.com/proxmox',
          version: '2.6.1',
        },
        {
          arch: 'amd64',
          download_url: 'https://downloads.example.com/proxmox',
          filename: 'aFileName.zip',
          name: 'Telmate/proxmox',
          os: 'windows',
          url: 'https://downloads.example.com/proxmox',
          version: '2.6.1',
        },
      ]);
    });

    it('return null if the retrieval of a single build fails', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/Telmate/proxmox/versions')
        .reply(200, telmateProxmoxVersions)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/darwin/arm64')
        .reply(200, {
          os: 'darwin',
          arch: 'arm64',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        })
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/linux/amd64')
        .reply(200, {
          os: 'linux',
          arch: 'amd64',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        })
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/linux/arm')
        .reply(200, {
          os: 'linux',
          arch: 'arm',
          filename: 'aFileName.zip',
          download_url: 'https://downloads.example.com/proxmox',
        })
        .get('/v1/providers/Telmate/proxmox/2.6.1/download/windows/amd64')
        .reply(404);
      const res = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'Telmate/proxmox',
        '2.6.1',
      );
      expect(res).toBeNull();
    });
  });

  describe('getZipHashes', () => {
    it('can fetch zip hashes', async () => {
      httpMock
        .scope(secondaryUrl)
        .get(
          '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
        )
        .reply(
          200,
          '500d4e787bf046bbe64c4853530aff3dfddee2fdbff0087d7b1e7a8c24388628 terraform-provider-azurerm_2.56.0_darwin_amd64.zip\n' +
            '766ff42596d643f9945b3aab2e83e306fe77c3020a5196366bbbb77eeea13b71 terraform-provider-azurerm_2.56.0_linux_amd64.zip\n' +
            'fbdb892d9822ed0e4cb60f2fedbdbb556e4da0d88d3b942ae963ed6ff091e48f terraform-provider-azurerm_2.56.0_manifest.json',
        );

      const res = await terraformProviderDatasource.getZipHashes(
        'https://releases.hashicorp.com/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
      );

      expect(res).toMatchObject([
        '500d4e787bf046bbe64c4853530aff3dfddee2fdbff0087d7b1e7a8c24388628',
        '766ff42596d643f9945b3aab2e83e306fe77c3020a5196366bbbb77eeea13b71',
        'fbdb892d9822ed0e4cb60f2fedbdbb556e4da0d88d3b942ae963ed6ff091e48f',
      ]);
    });

    it('does not hard fail when the ziphashes endpoint is not available', async () => {
      httpMock
        .scope(secondaryUrl)
        .get(
          '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
        )
        .reply(404);

      const res = await terraformProviderDatasource.getZipHashes(
        'https://releases.hashicorp.com/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
      );

      expect(res).toBeUndefined();
    });
  });
});
