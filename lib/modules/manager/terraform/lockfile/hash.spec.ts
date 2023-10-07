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
const releaseBackendGoogleSha256 = Fixtures.get(
  'releaseBackendGoogle_4_84_0_SHA256SUMS'
);
const terraformCloudSDCJson = Fixtures.get(
  'service-discovery.json',
  '../../../../modules/datasource/terraform-provider/'
);
const terraformCloudBackendAzurermVersions = Fixtures.get(
  'azurerm-provider-versions.json',
  '../../../../modules/datasource/terraform-provider/'
);
const terraformCloudBackendGoogleVersions = Fixtures.get(
  'terraformCloudBackendGoogleVersions.json'
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
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      'zh:0b3e945fa76876c312bdddca7b18c93b734998febb616b2ebb84a0a299ae97c2',
      'zh:1d47d00730fab764bddb6d548fed7e124739b0bcebb9f3b3c6aa247de55fb804',
      'zh:29bff92b4375a35a7729248b3bc5db8991ca1b9ba640fc25b13700e12f99c195',
      'zh:382353516e7d408a81f1a09a36f9015429be73ca3665367119aad88713209d9a',
      'zh:78afa20e25a690d076eeaafd7879993ef9763a8a1b6762e2cbe42330464cc1fa',
      'zh:8f6422e94de865669b33a2d9fb95a3e392e841988e890f7379a206e9d47e3415',
      'zh:be5c7b52c893b971c860146aec643f7007f34430106f101eab686ed81eccbd26',
      'zh:bfc37b641bf3378183eb3b8735554c3949a5cfaa8f76403d7eff38de1474b6d9',
      'zh:c834f88dc8eb21af992871ed13a221015ae3b051aeca7386662071026f1546b4',
      'zh:f3296c8c0d57dc28e23cf91717484264531655ac478d994584ebc73f70679471',
      'zh:f569b65999264a9416862bca5cd2a6177d94ccb0424f3a4ef424428912b9cb3c',
      'zh:f8efe114ff4891776f48f7d2620b8d6963d3ddac6e42ce25bc761343da964c24',
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
