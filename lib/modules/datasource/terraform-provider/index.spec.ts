import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getPkgReleases } from '../index.ts';
import { TerraformProviderDatasource } from './index.ts';

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

type MockVariant = 'empty' | '404' | 'error';

function mockDefaultRegistryLookup(variant: MockVariant): void {
  const primaryScope = httpMock
    .scope(primaryUrl)
    .get('/v2/providers/hashicorp/azurerm')
    .query({ include: 'provider-versions' });
  const secondaryScope = httpMock
    .scope(secondaryUrl)
    .get('/terraform-provider-azurerm/index.json');

  if (variant === 'empty') {
    primaryScope.reply(200, {});
    secondaryScope.reply(200, {});
    return;
  }

  if (variant === '404') {
    primaryScope.reply(404);
    secondaryScope.reply(404);
    return;
  }

  primaryScope.replyWithError('');
  secondaryScope.replyWithError('');
}

function mockThirdPartyRegistryLookup(variant: MockVariant): void {
  const scope = httpMock
    .scope('https://registry.company.com')
    .get('/v1/providers/hashicorp/azurerm/versions');

  if (variant === 'empty') {
    scope.reply(200, {});
  } else if (variant === '404') {
    scope.reply(404);
  } else {
    scope.replyWithError('');
  }

  httpMock
    .scope('https://registry.company.com')
    .get('/.well-known/terraform.json')
    .reply(200, serviceDiscoveryResult);
}

describe('modules/datasource/terraform-provider/index', () => {
  describe('getReleases', () => {
    it.each`
      description         | variant
      ${'empty results'}  | ${'empty'}
      ${'404 responses'}  | ${'404'}
      ${'unknown errors'} | ${'error'}
    `(
      'returns null when both default registries return $description',
      async ({ variant }) => {
        mockDefaultRegistryLookup(variant);

        expect(
          await getPkgReleases({
            datasource: TerraformProviderDatasource.id,
            packageName: 'azurerm',
          }),
        ).toBeNull();
      },
    );

    it('processes real data', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v2/providers/hashicorp/azurerm')
        .query({ include: 'provider-versions' })
        .reply(200, {
          data: {
            attributes: {
              source: 'https://github.com/hashicorp/terraform-provider-azurerm',
            },
          },
          included: [
            {
              type: 'provider-versions',
              attributes: {
                version: '2.52.0',
                'published-at': '2019-11-19T08:22:56Z',
              },
            },
            {
              type: 'provider-versions',
              attributes: {
                version: '2.53.0',
                'published-at': '2019-11-26T08:22:56Z',
              },
            },
          ],
        });
      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        packageName: 'azurerm',
      });
      expect(res).toEqual({
        homepage: 'https://registry.terraform.io/providers/hashicorp/azurerm',
        registryUrl: 'https://registry.terraform.io',
        releases: [
          {
            releaseTimestamp: '2019-11-19T08:22:56.000Z',
            version: '2.52.0',
          },
          {
            releaseTimestamp: '2019-11-26T08:22:56.000Z',
            version: '2.53.0',
          },
        ],
        sourceUrl: 'https://github.com/hashicorp/terraform-provider-azurerm',
      });
    });

    it.each`
      description         | variant
      ${'empty results'}  | ${'empty'}
      ${'404 responses'}  | ${'404'}
      ${'unknown errors'} | ${'error'}
    `(
      'returns null when a third-party registry returns $description',
      async ({ variant }) => {
        mockThirdPartyRegistryLookup(variant);

        expect(
          await getPkgReleases({
            datasource: TerraformProviderDatasource.id,
            packageName: 'azurerm',
            registryUrls: ['https://registry.company.com'],
          }),
        ).toBeNull();
      },
    );

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
        .get('/v2/providers/hashicorp/google-beta')
        .query({ include: 'provider-versions' })
        .reply(404, {
          errors: ['Not Found'],
        });
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

    it('processes real data from OpenTofu registry docs API', async () => {
      httpMock
        .scope('https://api.opentofu.org')
        .get('/registry/docs/providers/hashicorp/azurerm/index.json')
        .reply(200, {
          versions: [
            { id: 'v2.53.0', published: '2019-11-26T08:22:56Z' },
            { id: 'v2.52.0', published: '2019-11-19T08:22:56Z' },
          ],
        })
        .get('/registry/docs/providers/hashicorp/azurerm/v2.53.0/index.json')
        .reply(200, {
          link: 'https://github.com/opentofu/terraform-provider-azurerm/tree/v2.53.0',
        });

      const res = await getPkgReleases({
        datasource: TerraformProviderDatasource.id,
        packageName: 'hashicorp/azurerm',
        registryUrls: ['https://registry.opentofu.org'],
      });

      expect(res).toEqual({
        homepage: 'https://search.opentofu.org/provider/hashicorp/azurerm',
        registryUrl: 'https://registry.opentofu.org',
        sourceUrl: 'https://github.com/opentofu/terraform-provider-azurerm',
        releases: [
          {
            releaseTimestamp: '2019-11-19T08:22:56.000Z',
            version: 'v2.52.0',
          },
          {
            releaseTimestamp: '2019-11-26T08:22:56.000Z',
            version: 'v2.53.0',
          },
        ],
      });
    });

    it('returns an empty release list for OpenTofu registry without versions', async () => {
      httpMock
        .scope('https://api.opentofu.org')
        .get('/registry/docs/providers/hashicorp/azurerm/index.json')
        .reply(200, {});

      expect(
        await getPkgReleases({
          datasource: TerraformProviderDatasource.id,
          packageName: 'hashicorp/azurerm',
          registryUrls: ['https://registry.opentofu.org'],
        }),
      ).toEqual({
        homepage: 'https://search.opentofu.org/provider/hashicorp/azurerm',
        releases: [],
      });
    });
  });

  describe('getBuilds', () => {
    it('throws for empty result', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/hashicorp/azurerm/versions')
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);

      const result = terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'hashicorp/azurerm',
        '2.50.0',
      );
      await expect(result).rejects.toThrow(ExternalHostError);
    });

    it('returns null for non hashicorp dependency and releases.hashicorp.com registryUrl', async () => {
      const result = await terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[1],
        'test/azurerm',
        '2.50.0',
      );
      expect(result).toBeNull();
    });

    it('works for hashicorp dependency and releases.hashicorp.com', async () => {
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/2.50.0/index.json')
        .reply(200, { builds: [] });
      const result = await terraformProviderDatasource.getBuilds(
        secondaryUrl,
        'hashicorp/azurerm',
        '2.50.0',
      );
      expect(result).toBeEmptyArray();
    });

    it('throws for hashicorp dependency and releases.hashicorp.com 500', async () => {
      httpMock
        .scope(secondaryUrl)
        .get('/terraform-provider-azurerm/2.50.0/index.json')
        .reply(500);
      const result = terraformProviderDatasource.getBuilds(
        secondaryUrl,
        'hashicorp/azurerm',
        '2.50.0',
      );
      await expect(result).rejects.toThrow(ExternalHostError);
    });

    it('rethrows external-host-error for hashicorp dependency and releases.hashicorp.com', async () => {
      vi.spyOn(
        terraformProviderDatasource,
        'getReleaseBackendIndex',
      ).mockRejectedValue(new ExternalHostError(new Error('Test error')));
      const result = terraformProviderDatasource.getBuilds(
        secondaryUrl,
        'hashicorp/azurerm',
        '2.50.0',
      );
      await expect(result).rejects.toThrow(ExternalHostError);
    });

    it('throws if service discovery error', async () => {
      vi.spyOn(
        terraformProviderDatasource,
        'getTerraformServiceDiscoveryResult',
        // @ts-expect-error - should never happen
      ).mockResolvedValueOnce(null);
      const result = terraformProviderDatasource.getBuilds(
        primaryUrl,
        'hashicorp/azurerm',
        '2.50.0',
      );
      await expect(result).rejects.toThrow(ExternalHostError);
    });

    it('throws if a version is requested which is not available', async () => {
      httpMock
        .scope(primaryUrl)
        .get('/v1/providers/Telmate/proxmox/versions')
        .reply(200, telmateProxmoxVersions)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const result = terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'Telmate/proxmox',
        '2.8.0',
      );
      await expect(result).rejects.toThrow(ExternalHostError);
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

    it('throws if the retrieval of a single build fails', async () => {
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
      const res = terraformProviderDatasource.getBuilds(
        terraformProviderDatasource.defaultRegistryUrls[0],
        'Telmate/proxmox',
        '2.6.1',
      );
      await expect(res).rejects.toThrow(ExternalHostError);
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
