import { createReadStream } from 'node:fs';
import { DirectoryResult, dir } from 'tmp-promise';
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
const releaseBackendAzurermSha256 = Fixtures.get(
  'releaseBackendAzurerm_2_56_0_SHA256SUMS'
);
const releaseBackendGoogleSha256 = Fixtures.get(
  'releaseBackendGoogle_4_84_0_SHA256SUMS'
);
const terraformCloudSDCJson = Fixtures.get('terraformCloudSDC.json');
const terraformCloudBackendAzurermVersions = Fixtures.get(
  'terraforCloudBackendAzurermVersions.json'
);
const terraformCloudBackendGoogleVersions = Fixtures.get(
  'terraforCloudBackendGoogleVersions.json'
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
      '2.56.0'
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
      '2.59.0'
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
      '2.56.0'
    );
    expect(result).toBeNull();
  });

  it('fail to create hashes', async () => {
    const readStreamLinux = createReadStream(
      getFixturePath('releaseBackendAzurerm_2_56_0.json')
    );
    const readStreamDarwin = createReadStream(
      getFixturePath('releaseBackendAzurerm_2_56_0.json')
    );
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .reply(200, releaseBackendAzurerm)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip'
      )
      .reply(200, readStreamLinux)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip'
      )
      .reply(200, readStreamDarwin);

    await expect(
      TerraformProviderHash.createHashes(
        'https://releases.hashicorp.com',
        'hashicorp/azurerm',
        '2.56.0'
      )
    ).rejects.toThrow();
  });

  it('full walkthrough', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
    );
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .reply(200, releaseBackendAzurerm)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip'
      )
      .reply(200, readStreamLinux)
      .get(
        '/terraform-provider-azurerm/2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip'
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0'
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
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
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
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_SHA256SUMS'
      )
      .reply(200, releaseBackendAzurermSha256)
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip'
      )
      .reply(200, readStreamLinux)
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip'
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'hashicorp/azurerm',
      '2.56.0'
    );
    expect(log.error.mock.calls).toMatchSnapshot();
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(13);
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'zh:1994185185046df38eb1d1ad3c3b07e4f964224e4ab756957473b754f6aec75c',
      'zh:202556c142f001830dd4514d475dc747f863ad588382c43daa604d53761f59f5',
      'zh:3010bcf9ebe33e1195f0a7507183959918c6b88bbdc84c8cc96919654e0abcb0',
      'zh:39ff556080515b170b10f365a0f95abf2590e9ca3d79261defea1e3133e79088',
      'zh:500d4e787bf046bbe64c4853530aff3dfddee2fdbff0087d7b1e7a8c24388628',
      'zh:766ff42596d643f9945b3aab2e83e306fe77c3020a5196366bbbb77eeea13b71',
      'zh:8a7a6548a383a12aa137b0441c15fc7243a1d3e4fd8a9292946ef423d2d8bcff',
      'zh:bb9f5e9289df17a7a07bdd3add79e41a195e3d129c2ab974b5bb6272c9812068',
      'zh:ce72eaaecccb50f52f50c69ed3261b0a4050b846f2e664d120d30dfeb65067bc',
      'zh:d10b33dd19316ef10965ad0fb8ca6f2743bceaf5167bd8e6e25815e20786f190',
      'zh:fe5aba92430104238f66aaaf02acf323d457d387cd33d6b3d8c6fdd9e449b834',
    ]);
  });

  it('full walkthrough without ziphashes available', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
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
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_linux_amd64.zip'
      )
      .reply(200, readStreamLinux)
      .get(
        '/hashicorp/terraform-provider-azurerm/releases/download/v2.56.0/terraform-provider-azurerm_2.56.0_darwin_amd64.zip'
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'hashicorp/azurerm',
      '2.56.0'
    );
    expect(log.error.mock.calls).toMatchSnapshot();
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(2);
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
    ]);
  });

  it('contains a ziphash for manifest files not directly used', async () => {
    const readStreamLinux = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
    );
    const readStreamDarwin = createReadStream(
      'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip'
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
        '/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_SHA256SUMS'
      )
      .reply(200, releaseBackendGoogleSha256)
      .get(
        '/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_linux_amd64.zip'
      )
      .reply(200, readStreamLinux)
      .get(
        '/hashicorp/terraform-provider-google/releases/download/v4.84.0/terraform-provider-google_4.84.0_darwin_amd64.zip'
      )
      .reply(200, readStreamDarwin);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.terraform.io',
      'hashicorp/google',
      '4.84.0'
    );
    expect(log.error.mock.calls).toMatchSnapshot();
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(14);
    expect(result).toContain(
      // The hash of a terraform-provider-manifest.json file not fetched by getBuilds
      'zh:f569b65999264a9416862bca5cd2a6177d94ccb0424f3a4ef424428912b9cb3c'
    );
  });
});
