import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { TerraformProviderDatasource } from '.';

const azurermData = Fixtures.get('azurerm-provider.json');
const azurermVersionsData = Fixtures.get('azurerm-provider-versions.json');
const azurerm2560VersionData = Fixtures.get(
  'azurerm-provider-2.56.0-version.json'
);
const azurerm2560Sha256Sums = Fixtures.get(
  'azurerm-provider-2.56.0-sha256sums'
);
const hashicorpGoogleBetaReleases = Fixtures.get(
  'releaseBackendIndexGoogleBeta.json'
);
const serviceDiscoveryResult = Fixtures.get('service-discovery.json');
const telmateProxmoxVersions = Fixtures.get(
  'telmate-proxmox-versions-response.json'
);
const proxmox261Sha256Sums = Fixtures.get('telmate-proxmox-2.6.1-sha256sums');

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
        })
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
        })
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
        })
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
        })
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
        })
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
        })
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
        })
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
        '2.50.0'
      );
      expect(result).toBeNull();
    });

    it('returns null for non hashicorp dependency and releases.hashicorp.com registryUrl', async () => {
      const result = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[1],
        'test/azurerm',
        '2.50.0'
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
        '2.8.0'
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
        '2.6.1'
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
        '2.6.1'
      );
      expect(res).toBeNull();
    });
  });

  describe('getZipHashes', () => {
    it('can fetch zip hashes from official endpoint', async () => {
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/2.56.0/index.json')
        .reply(200, azurerm2560VersionData)
        .get(
          '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS'
        )
        .reply(200, azurerm2560Sha256Sums);

      const res = await terraformProviderDatasource.getZipHashes(
        secondaryUrl,
        'hashicorp/azurerm',
        '2.56.0'
      );

      expect(res).not.toBeNull();
      expect(res).toBeArray();
      expect(res).toMatchObject([
        '500d4e787bf046bbe64c4853530aff3dfddee2fdbff0087d7b1e7a8c24388628',
        '8a7a6548a383a12aa137b0441c15fc7243a1d3e4fd8a9292946ef423d2d8bcff',
        'd10b33dd19316ef10965ad0fb8ca6f2743bceaf5167bd8e6e25815e20786f190',
        '39ff556080515b170b10f365a0f95abf2590e9ca3d79261defea1e3133e79088',
        'ce72eaaecccb50f52f50c69ed3261b0a4050b846f2e664d120d30dfeb65067bc',
        '1994185185046df38eb1d1ad3c3b07e4f964224e4ab756957473b754f6aec75c',
        '766ff42596d643f9945b3aab2e83e306fe77c3020a5196366bbbb77eeea13b71',
        'bb9f5e9289df17a7a07bdd3add79e41a195e3d129c2ab974b5bb6272c9812068',
        '202556c142f001830dd4514d475dc747f863ad588382c43daa604d53761f59f5',
        '3010bcf9ebe33e1195f0a7507183959918c6b88bbdc84c8cc96919654e0abcb0',
        'fe5aba92430104238f66aaaf02acf323d457d387cd33d6b3d8c6fdd9e449b834',
      ]);
    });

    it('can fetch zip hashes from community endpoint', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/providers/Telmate/proxmox/2.6.1')
        .reply(200, {
          name: 'proxmox',
          source: 'https://github.com/Telmate/terraform-provider-proxmox',
          tag: 'v2.6.1',
        });

      httpMock
        .scope('https://github.com')
        .get(
          '/Telmate/terraform-provider-proxmox/releases/download/v2.6.1/terraform-provider-proxmox_2.6.1_SHA256SUMS'
        )
        .reply(200, proxmox261Sha256Sums);

      const res = await terraformProviderDatasource.getZipHashes(
        primaryUrl,
        'Telmate/proxmox',
        '2.6.1'
      );

      expect(res).not.toBeNull();
      expect(res).toBeArray();
      expect(res).toMatchObject([
        '0837e6a52120caa538330278c13086f7a7d8c15be2000afdf73fcb2f0d30daa1',
        '2964c02fd3eeff4f19aead79c91087e7375eca1bb582036ea1105cd4d5949e2f',
        '4540f5fd9db1d2d07466e00a09b610d64ac86ff72ba6f7cbfa8161b07e5c9d04',
        '660d6b9b931cc0a2dc8c3c47058448d5cdfcccc38f371441c23e8e5de1a77ba8',
        '6e01766d94883a77c1883a71784d6cdc1f04f862fa8087043ce06a4b9d8c9ea6',
        '80d8fb293008b9d226996acd158b1a69208b67df15cc15b23a5a24957356400d',
        '8cd7def49251517bf65dd8a345ae047dc4dd2e1e6178e4c20e4d473f507b3004',
        'a51bd83d57fe718bb5b86d8c464dcd152558ea7bc04bdeb6202690722e5288b5',
        'a70f60a5ce57a40857226d8728684bc6a752e1a0003fac0e5cbc87428a87364a',
        'b7b27e276c0bb79acb262564db151988d676c96d6384debdf4b7c21bd0967cea',
        'c215f5f6a4a34238307294f4900c12c704f99e0e69e9d2a265d40f92b6ccb759',
      ]);
    });

    it('does not download non-hasicorp providers from the official releases endpoint', async () => {
      const res = await terraformProviderDatasource.getZipHashes(
        secondaryUrl,
        'Telmate/proxmox',
        '2.6.1'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });

    it('does not hard fail on official endpoint when there is no manifest available', async () => {
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/2.56.0/index.json')
        .reply(404);

      const res = await terraformProviderDatasource.getZipHashes(
        secondaryUrl,
        'hashicorp/azurerm',
        '2.56.0'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });

    it('does not hard fail on community endpoint when service discovery is empty', async () => {
      httpMock.scope(primaryUrl).get('/.well-known/terraform.json').reply(200);

      const res = await terraformProviderDatasource.getZipHashes(
        primaryUrl,
        'Telmate/proxmox',
        '2.6.1'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });

    it('does not hard fail on community endpoint when there is no manifest available', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/providers/Telmate/proxmox/2.6.1')
        .reply(404);

      const res = await terraformProviderDatasource.getZipHashes(
        primaryUrl,
        'Telmate/proxmox',
        '2.6.1'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });

    it('does not hard fail on community endpoint when no tag is known', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/providers/Telmate/proxmox/2.6.1')
        .reply(200, {
          name: 'proxmox',
          source: 'https://github.com/Telmate/terraform-provider-proxmox',
        });

      const res = await terraformProviderDatasource.getZipHashes(
        primaryUrl,
        'Telmate/proxmox',
        '2.6.1'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });

    it('stops when the source repository is not supported', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/providers/Telmate/proxmox/2.6.1')
        .reply(200, {
          name: 'proxmox',
          source:
            'https://notgithub.example.com/Telmate/terraform-provider-proxmox',
          tag: 'v2.6.0',
        });

      const res = await terraformProviderDatasource.getZipHashes(
        primaryUrl,
        'Telmate/proxmox',
        '2.6.1'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });

    it('does not hard fail when the ziphashes endpoint is not available', async () => {
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/2.56.0/index.json')
        .reply(200, azurerm2560VersionData)
        .get(
          '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS'
        )
        .reply(404);

      const res = await terraformProviderDatasource.getZipHashes(
        secondaryUrl,
        'hashicorp/azurerm',
        '2.56.0'
      );

      expect(res).not.toBeNull();
      expect(res).toBeEmptyArray();
    });
  });
});
