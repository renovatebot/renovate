import { createReadStream } from 'node:fs';
import { DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { Fixtures } from '../../../../../test/fixtures';
import * as httpMock from '../../../../../test/http-mock';
import { getFixturePath, logger } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import { TerraformProviderHash } from './hash';

const releaseBackendUrl = TerraformProviderDatasource.defaultRegistryUrls[1];
const terraformCloudReleaseBackendUrl =
  TerraformProviderDatasource.defaultRegistryUrls[0];
const releaseBackendAzurerm = Fixtures.get('releaseBackendAzurerm_2_56_0.json');
const releaseBackendGoogleSha256 = Fixtures.get(
  'releaseBackendGoogle_4_84_0_SHA256SUMS',
);
const terraformCloudSDCJson = Fixtures.get(
  'service-discovery.json',
  '../../../../modules/datasource/terraform-provider/',
);
const terraformCloudBackendAzurermVersions = Fixtures.get(
  'terraformCloudBackendAzurermVersions.json',
);
const terraformCloudBackendGoogleVersions = Fixtures.get(
  'terraformCloudBackendGoogleVersions.json',
);

const log = logger.logger;

describe('modules/manager/terraform/lockfile/hash', () => {
  let cacheDir: DirectoryResult;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });
  });

  afterEach(() => cacheDir.cleanup());

  it('returns null if getBuilds returns null', async () => {
    httpMock
      .scope('https://example.com')
      .get('/.well-known/terraform.json')
      .reply(200, '');
    const result = await TerraformProviderHash.createHashes(
      'https://example.com',
      'test/gitlab',
      '2.56.0',
    );
    expect(result).toBeNull();
  });

  it('return null if requesting a version which is not available', async () => {
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.59.0/index.json')
      .reply(403, '');

    const result = await TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.59.0',
    );
    expect(result).toBeNull();
  });

  it('backend index throws error', async () => {
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .replyWithError('');

    const result = await TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0',
    );
    expect(result).toBeNull();
  });

  it('fail to create hashes', async () => {
    const readStreamLinux = createReadStream(
      getFixturePath('releaseBackendAzurerm_2_56_0.json'),
    );
    const readStreamDarwin = createReadStream(
      getFixturePath('releaseBackendAzurerm_2_56_0.json'),
    );
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .reply(200, releaseBackendAzurerm)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip',
      )
      .reply(200, readStreamLinux)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
      )
      .reply(200, readStreamDarwin);

    await expect(
      TerraformProviderHash.createHashes(
        'https://releases.hashicorp.com',
        'hashicorp/azurerm',
        '2.56.0',
      ),
    ).rejects.toThrow();
  });

  it('full walkthrough', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .reply(200, releaseBackendAzurerm)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip',
      )
      .reply(200, readStreamLinux)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0',
    );
    expect(log.error.mock.calls).toMatchSnapshot();
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(2);
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
    ]);
  });

  it('full walkthrough on terraform cloud', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    httpMock
      .scope(terraformCloudReleaseBackendUrl)
      .get('/.well-known/terraform.json')
      .reply(200, terraformCloudSDCJson)
      .get('/v1/providers/hashicorp/google/versions')
      .reply(200, terraformCloudBackendGoogleVersions)
      .get('/v1/providers/hashicorp/google/4.84.0/download/linux/amd64')
      .reply(200, {
        os: 'linux',
        arch: 'amd64',
        filename: 'terraform-provider-google_4.84.0_linux_amd64.zip',
        shasums_url:
          'https://github.com/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_SHA256SUMS',
        download_url:
          'https://github.com/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_linux_amd64.zip',
      })
      .get('/v1/providers/hashicorp/google/4.84.0/download/darwin/amd64')
      .reply(200, {
        os: 'darwin',
        arch: 'amd64',
        filename: 'terraform-provider-google_4.84.0_darwin_amd64.zip',
        shasums_url:
          'https://github.com/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_SHA256SUMS',
        download_url:
          'https://github.com/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_darwin_amd64.zip',
      });

    httpMock
      .scope('https://github.com')
      .get(
        '/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_SHA256SUMS',
      )
      .reply(200, releaseBackendGoogleSha256)
      .get(
        '/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_linux_amd64.zip',
      )
      .reply(200, readStreamLinux)
      .get(
        '/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_darwin_amd64.zip',
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'hashicorp/google',
      '4.84.0',
    );
    expect(log.error.mock.calls).toBeEmptyArray();
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'zh:1d47d00730fab764bddb6d548fed7e124739b0bcebb9f3b3c6aa247de55fb804',
      'zh:29bff92b4375a35a7729248b3bc5db8991ca1b9ba640fc25b13700e12f99c195',
      // The hash of a terraform-provider-manifest.json file not fetched by getBuilds
      'zh:f569b65999264a9416862bca5cd2a6177d94ccb0424f3a4ef424428912b9cb3c',
    ]);
  });

  it('full walkthrough with different shasum per build', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    httpMock
      .scope(terraformCloudReleaseBackendUrl)
      .get('/.well-known/terraform.json')
      .reply(200, terraformCloudSDCJson)
      .get('/v1/providers/gravitational/teleport/versions')
      .reply(
        200,
        JSON.stringify({
          id: 'gravitational/teleport',
          versions: [
            {
              version: '14.3.1',
              protocols: ['5.0'],
              platforms: [
                {
                  os: 'linux',
                  arch: 'amd64',
                },
                {
                  os: 'darwin',
                  arch: 'amd64',
                },
              ],
            },
            {
              version: '1.33.0',
              protocols: ['4.0', '5.0'],
              platforms: [
                {
                  os: 'linux',
                  arch: 'amd64',
                },
                {
                  os: 'darwin',
                  arch: 'amd64',
                },
              ],
            },
          ],
          warnings: null,
        }),
      )
      .get('/v1/providers/gravitational/teleport/14.3.1/download/linux/amd64')
      .reply(200, {
        os: 'linux',
        arch: 'amd64',
        filename: 'terraform-provider-teleport-v14.3.1-linux-amd64-bin.zip',
        shasums_url:
          'https://terraform.releases.teleport.dev/store/terraform-provider-teleport-v14.3.1-linux-amd64-bin.zip.sums',
        download_url:
          'https://terraform.releases.teleport.dev/store/terraform-provider-teleport-v14.3.1-linux-amd64-bin.zip',
      })
      .get('/v1/providers/gravitational/teleport/14.3.1/download/darwin/amd64')
      .reply(200, {
        os: 'darwin',
        arch: 'amd64',
        filename: 'terraform-provider-teleport-v14.3.1-darwin-amd64-bin.zip',
        shasums_url:
          'https://terraform.releases.teleport.dev/store/terraform-provider-teleport-v14.3.1-darwin-amd64-bin.zip.sums',
        download_url:
          'https://terraform.releases.teleport.dev/store/terraform-provider-teleport-v14.3.1-darwin-amd64-bin.zip',
      });

    httpMock
      .scope('https://terraform.releases.teleport.dev')
      .get(
        '/store/terraform-provider-teleport-v14.3.1-linux-amd64-bin.zip.sums',
      )
      .reply(
        200,
        '1d47d00730fab764bddb6d548fed7e124739b0bcebb9f3b3c6aa247de55fb804  terraform-provider-teleport-v14.3.1-linux-amd64-bin.zip',
      )
      .get('/store/terraform-provider-teleport-v14.3.1-linux-amd64-bin.zip')
      .reply(200, readStreamLinux)
      .get(
        '/store/terraform-provider-teleport-v14.3.1-darwin-amd64-bin.zip.sums',
      )
      .reply(
        200,
        '29bff92b4375a35a7729248b3bc5db8991ca1b9ba640fc25b13700e12f99c195  terraform-provider-teleport-v14.3.1-darwin-amd64-bin.zip',
      )
      .get('/store/terraform-provider-teleport-v14.3.1-darwin-amd64-bin.zip')
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'gravitational/teleport',
      '14.3.1',
    );
    expect(log.error.mock.calls).toBeEmptyArray();
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'zh:1d47d00730fab764bddb6d548fed7e124739b0bcebb9f3b3c6aa247de55fb804',
      'zh:29bff92b4375a35a7729248b3bc5db8991ca1b9ba640fc25b13700e12f99c195',
    ]);
  });

  it('full walkthrough without ziphashes available', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    httpMock
      .scope(terraformCloudReleaseBackendUrl)
      .get('/.well-known/terraform.json')
      .reply(200, terraformCloudSDCJson)
      .get('/v1/providers/hashicorp/azurerm/versions')
      .reply(200, terraformCloudBackendAzurermVersions)
      .get('/v1/providers/hashicorp/azurerm/2.56.0/download/linux/amd64')
      .reply(200, {
        os: 'linux',
        arch: 'amd64',
        filename: 'terraform-provider-azurerm_2.56.0_linux_amd64.zip',
        download_url:
          'https://github.com/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip',
      })
      .get('/v1/providers/hashicorp/azurerm/2.56.0/download/darwin/amd64')
      .reply(200, {
        os: 'darwin',
        arch: 'amd64',
        filename: 'terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
        download_url:
          'https://github.com/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
      });

    httpMock
      .scope('https://github.com')
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip',
      )
      .reply(200, readStreamLinux)
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'hashicorp/azurerm',
      '2.56.0',
    );
    expect(log.error.mock.calls).toBeEmptyArray();
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
    ]);
  });

  it('it does not add any ziphashes when the shasums endpoint fails`', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
    );

    httpMock
      .scope(terraformCloudReleaseBackendUrl)
      .get('/.well-known/terraform.json')
      .reply(200, terraformCloudSDCJson)
      .get('/v1/providers/hashicorp/azurerm/versions')
      .reply(200, terraformCloudBackendAzurermVersions)
      .get('/v1/providers/hashicorp/azurerm/2.56.0/download/linux/amd64')
      .reply(200, {
        os: 'linux',
        arch: 'amd64',
        filename: 'terraform-provider-azurerm_2.56.0_linux_amd64.zip',
        shasums_url:
          'https://github.com/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
        download_url:
          'https://github.com/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip',
      })
      .get('/v1/providers/hashicorp/azurerm/2.56.0/download/darwin/amd64')
      .reply(200, {
        os: 'darwin',
        arch: 'amd64',
        filename: 'terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
        shasums_url:
          'https://github.com/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
        download_url:
          'https://github.com/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
      });

    httpMock
      .scope('https://github.com')
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS',
      )
      .replyWithError('endoint failed')
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip',
      )
      .reply(200, readStreamLinux)
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip',
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'hashicorp/azurerm',
      '2.56.0',
    );

    expect(log.error.mock.calls).toBeEmptyArray();
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
    ]);
  });

  describe('hashOfZipContent', () => {
    const zipWithFolderPath = Fixtures.getPath('test_with_folder.zip');

    it('return hash for content with subfolders', async () => {
      await expect(
        TerraformProviderHash.hashOfZipContent(
          zipWithFolderPath,
          upath.join(cacheDir.path, 'test'),
        ),
      ).resolves.toBe('g92f/mR2hlVmeWBlplxxJyP2H3fdyPwYccr7uJhcRz8=');
    });
  });
});
