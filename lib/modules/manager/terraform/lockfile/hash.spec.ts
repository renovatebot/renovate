import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { codeBlock } from 'common-tags';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import * as yauzl from 'yauzl';
import { ZipFile } from 'yazl';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { getFixturePath, logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { ExternalHostError } from '../../../../types/errors/external-host-error.ts';
import * as fs from '../../../../util/fs/index.ts';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider/index.ts';
import type { TerraformBuild } from '../../../datasource/terraform-provider/schema.ts';
import { TerraformProviderHash } from './hash.ts';

async function writeZip(
  zipFilePath: string,
  addEntries: (archive: ZipFile) => void,
): Promise<void> {
  const archive = new ZipFile();
  addEntries(archive);
  const writePromise = pipeline(
    archive.outputStream,
    createWriteStream(zipFilePath),
  );
  archive.end();
  await writePromise;
}

function replaceZipEntryName(
  zip: Buffer,
  originalName: string,
  replacementName: string,
): number {
  const original = Buffer.from(originalName);
  const replacement = Buffer.from(replacementName);
  expect(replacement).toHaveLength(original.length);

  let offset = 0;
  let replacements = 0;
  while ((offset = zip.indexOf(original, offset)) !== -1) {
    replacement.copy(zip, offset);
    offset += replacement.length;
    replacements += 1;
  }
  return replacements;
}

const openTofuRegistryUrl = TerraformProviderDatasource.openTofuRegistryUrl;
const releaseBackendUrl = TerraformProviderDatasource.defaultRegistryUrls[1];
const terraformCloudReleaseBackendUrl =
  TerraformProviderDatasource.defaultRegistryUrls[0];
const releaseBackendAzurerm = Fixtures.get('releaseBackendAzurerm_2_56_0.json');
const terraformCloudSDCJson = Fixtures.get(
  'service-discovery.json',
  '../../../../modules/datasource/terraform-provider/',
);
const terraformCloudBackendAzurermVersions = Fixtures.get(
  'terraformCloudBackendAzurermVersions.json',
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
      .reply(200, {})
      .get('/test/gitlab/versions')
      .reply(200, { versions: [] });
    const result = TerraformProviderHash.createHashes(
      'https://example.com',
      'test/gitlab',
      '2.56.0',
    );
    await expect(result).rejects.toThrow(ExternalHostError);
  });

  it('return null if requesting a version which is not available', async () => {
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.59.0/index.json')
      .reply(403, '');

    const result = TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.59.0',
    );
    await expect(result).rejects.toThrow(ExternalHostError);
  });

  it('backend index throws error', async () => {
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .replyWithError('');

    const result = TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0',
    );
    await expect(result).rejects.toThrow(ExternalHostError);
  });

  it('returns null for no builds', async () => {
    vi.spyOn(
      TerraformProviderHash.terraformDatasource,
      'getBuilds',
    ).mockResolvedValueOnce(null);
    const result = await TerraformProviderHash.createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0',
    );
    expect(result).toBeNull();
  });

  it('deduplicates hashes from different shasum URLs and builds', async () => {
    const builds = [
      {
        name: 'example/provider',
        version: '1.0.0',
        os: 'linux',
        arch: 'amd64',
        filename: 'terraform-provider-example_1.0.0_linux_amd64.zip',
        url: 'https://example.com/linux.zip',
        shasums_url: 'https://example.com/SHA256SUMS?signature=one',
      },
      {
        name: 'example/provider',
        version: '1.0.0',
        os: 'darwin',
        arch: 'arm64',
        filename: 'terraform-provider-example_1.0.0_darwin_arm64.zip',
        url: 'https://example.com/darwin.zip',
        shasums_url: 'https://example.com/SHA256SUMS?signature=two',
      },
    ];
    const getBuilds = vi
      .spyOn(TerraformProviderHash.terraformDatasource, 'getBuilds')
      .mockResolvedValueOnce(builds);
    const getZipHashes = vi
      .spyOn(TerraformProviderHash.terraformDatasource, 'getZipHashes')
      .mockResolvedValue(['1234567890abcdef']);
    const calculateHashScheme1Hashes = vi
      .spyOn(TerraformProviderHash, 'calculateHashScheme1Hashes')
      .mockResolvedValueOnce(['same-hash', 'same-hash']);

    const result = await TerraformProviderHash.createHashes(
      'https://registry.example.com',
      'example/provider',
      '1.0.0',
    );

    expect(getZipHashes).toHaveBeenCalledTimes(2);
    expect(result).toEqual(['h1:same-hash', 'zh:1234567890abcdef']);

    getBuilds.mockRestore();
    getZipHashes.mockRestore();
    calculateHashScheme1Hashes.mockRestore();
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
    ).rejects.toThrow('End of central directory record signature not found');
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
    expect(result).toBeArrayOfSize(1);
    expect(result).toMatchObject([
      'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
    ]);
  });

  it('full walkthrough on terraform cloud', async () => {
    const releaseBackendGoogleSha256 = codeBlock`
      1d47d00730fab764bddb6d548fed7e124739b0bcebb9f3b3c6aa247de55fb804  terraform-provider-google_4.84.0_linux_amd64.zip
      29bff92b4375a35a7729248b3bc5db8991ca1b9ba640fc25b13700e12f99c195  terraform-provider-google_4.84.0_darwin_amd64.zip
      f569b65999264a9416862bca5cd2a6177d94ccb0424f3a4ef424428912b9cb3c  terraform-provider-google_4.84.0_manifest.json
    `;
    const terraformCloudBackendGoogleVersions = {
      id: 'hashicorp/google',
      versions: [
        {
          version: '4.84.0',
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
    };
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
    ]);
  });

  it('does not add any ziphashes when the shasums endpoint fails`', async () => {
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
    ]);
  });

  describe('OpenTofu fast path', () => {
    it('uses packages API without downloading zips', async () => {
      httpMock
        .scope(openTofuRegistryUrl)
        .get('/v1/providers/hashicorp/local/2.5.1/download/linux/amd64')
        .reply(200, {
          packages: {
            linux_amd64: {
              hashes: [
                'zh:422ce45691b2f384dbd4596fdc8209d95cb43d85a82aaa0173089d38976d6e96',
                'h1:GgW5qncKu4KnXLE1ZYv5iwmhSYtTNzsOvJAOQIyFR7E=',
              ],
            },
            darwin_arm64: {
              hashes: [
                'zh:c66529133599a419123ad2e42874afbd9aba82bd1de2b15cc68d2a1e665d4c8e',
                'h1:87L+rpGao062xifb1VuG9YVFwp9vbDP6G2fgfYxUkQs=',
              ],
            },
          },
        });

      const result = await TerraformProviderHash.createHashes(
        openTofuRegistryUrl,
        'hashicorp/local',
        '2.5.1',
      );

      expect(log.error.mock.calls).toBeEmptyArray();
      expect(result).toEqual([
        'h1:87L+rpGao062xifb1VuG9YVFwp9vbDP6G2fgfYxUkQs=',
        'h1:GgW5qncKu4KnXLE1ZYv5iwmhSYtTNzsOvJAOQIyFR7E=',
        'zh:422ce45691b2f384dbd4596fdc8209d95cb43d85a82aaa0173089d38976d6e96',
        'zh:c66529133599a419123ad2e42874afbd9aba82bd1de2b15cc68d2a1e665d4c8e',
      ]);
    });

    it('falls back to slow path when packages field is missing', async () => {
      const readStreamLinux = createReadStream(
        'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
      );
      const readStreamDarwin = createReadStream(
        'lib/modules/manager/terraform/lockfile/__fixtures__/test.zip',
      );

      httpMock
        .scope(openTofuRegistryUrl)
        // Fast-path attempt: response without `packages`
        .get('/v1/providers/hashicorp/local/2.5.1/download/linux/amd64')
        .reply(200, {
          os: 'linux',
          arch: 'amd64',
          filename: 'terraform-provider-local_2.5.1_linux_amd64.zip',
          download_url:
            'https://example.com/terraform-provider-local_2.5.1_linux_amd64.zip',
        })
        // Slow-path: service discovery + versions + per-platform downloads
        .get('/.well-known/terraform.json')
        .reply(200, terraformCloudSDCJson)
        .get('/v1/providers/hashicorp/local/versions')
        .reply(200, {
          id: 'hashicorp/local',
          versions: [
            {
              version: '2.5.1',
              platforms: [
                { os: 'linux', arch: 'amd64' },
                { os: 'darwin', arch: 'arm64' },
              ],
            },
          ],
        })
        .get('/v1/providers/hashicorp/local/2.5.1/download/linux/amd64')
        .reply(200, {
          os: 'linux',
          arch: 'amd64',
          filename: 'terraform-provider-local_2.5.1_linux_amd64.zip',
          download_url: 'https://example.com/linux.zip',
        })
        .get('/v1/providers/hashicorp/local/2.5.1/download/darwin/arm64')
        .reply(200, {
          os: 'darwin',
          arch: 'arm64',
          filename: 'terraform-provider-local_2.5.1_darwin_arm64.zip',
          download_url: 'https://example.com/darwin.zip',
        });

      httpMock
        .scope('https://example.com')
        .get('/linux.zip')
        .reply(200, readStreamLinux)
        .get('/darwin.zip')
        .reply(200, readStreamDarwin);

      const result = await TerraformProviderHash.createHashes(
        openTofuRegistryUrl,
        'hashicorp/local',
        '2.5.1',
      );

      expect(log.error.mock.calls).toBeEmptyArray();
      expect(result).toMatchObject([
        'h1:I2F2atKZqKEOYk1tTLe15Llf9rVqxz48ZL1eZB9g8zM=',
      ]);
    });
  });

  describe('hashOfZipContent', () => {
    const zipWithFolderPath = Fixtures.getPath('test_with_folder.zip');

    it('streams the recursive directory fixture without extracting it', async () => {
      const readCacheFile = vi.spyOn(fs, 'readCacheFile');

      await expect(
        TerraformProviderHash.hashOfZipContent(zipWithFolderPath),
      ).resolves.toBe('g92f/mR2hlVmeWBlplxxJyP2H3fdyPwYccr7uJhcRz8=');

      expect(readCacheFile).not.toHaveBeenCalled();
    });

    it('hashes nested paths, empty files, and stored entries', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'streaming-fixture.zip');
      await writeZip(zipFilePath, (archive) => {
        archive.addBuffer(
          Buffer.from('nested content'),
          'nested/deeper/file.txt',
        );
        archive.addBuffer(Buffer.alloc(0), 'empty.txt');
        archive.addBuffer(Buffer.from('stored content'), 'stored.txt', {
          compress: false,
        });
      });

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).resolves.toBe('FmiOVJrRLyrSAUWoZdPZz6alBSnQ0S+2ZCBGdWls+Lg=');
    });

    it('ignores directory entries ending in a backslash', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'backslash-directory.zip');
      await writeZip(zipFilePath, (archive) => {
        archive.addEmptyDirectory('folder');
      });

      const zip = await readFile(zipFilePath);
      expect(replaceZipEntryName(zip, 'folder/', 'folder\\')).toBe(2);
      await writeFile(zipFilePath, zip);

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).resolves.toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    });

    it('rejects entry names containing newlines', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'newline-path.zip');
      await writeZip(zipFilePath, (archive) => {
        archive.addBuffer(Buffer.from('provider content'), 'line-break.txt');
      });

      const zip = await readFile(zipFilePath);
      expect(
        replaceZipEntryName(zip, 'line-break.txt', 'line\nbreak.txt'),
      ).toBe(2);
      await writeFile(zipFilePath, zip);

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).rejects.toThrow('ZIP entry name contains a newline');
    });

    it('rejects duplicate normalized entry paths', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'duplicate-path.zip');
      await writeZip(zipFilePath, (archive) => {
        archive.addBuffer(Buffer.from('first'), 'a/file.txt');
        archive.addBuffer(Buffer.from('second'), 'b/file.txt');
      });

      const zip = await readFile(zipFilePath);
      expect(replaceZipEntryName(zip, 'b/file.txt', 'a/file.txt')).toBe(2);
      await writeFile(zipFilePath, zip);

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).rejects.toThrow('Duplicate ZIP entry path: a/file.txt');
    });

    it('rejects an entry whose contents do not match its CRC-32', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'invalid-crc.zip');
      await writeZip(zipFilePath, (archive) => {
        archive.addBuffer(Buffer.from('original content'), 'corrupted.txt', {
          compress: false,
        });
      });

      const zip = await readFile(zipFilePath);
      const fileNameLength = zip.readUInt16LE(26);
      const extraFieldLength = zip.readUInt16LE(28);
      zip[30 + fileNameLength + extraFieldLength] ^= 0xff;
      await writeFile(zipFilePath, zip);

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).rejects.toThrow('CRC-32 mismatch for ZIP entry corrupted.txt');
    });

    it('preserves unflagged UTF-8 filename bytes', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'unflagged-utf8.zip');
      const fileName = 'café.txt';
      const content = Buffer.from('provider content');
      await writeZip(zipFilePath, (archive) => {
        archive.addBuffer(content, fileName);
      });

      const zip = await readFile(zipFilePath);
      zip.writeUInt16LE(zip.readUInt16LE(6) & ~0x800, 6);
      const centralDirectoryOffset = zip.indexOf(Buffer.from('PK\x01\x02'));
      expect(centralDirectoryOffset).toBeGreaterThan(-1);
      zip.writeUInt16LE(
        zip.readUInt16LE(centralDirectoryOffset + 8) & ~0x800,
        centralDirectoryOffset + 8,
      );
      await writeFile(zipFilePath, zip);

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).resolves.toBe('mhCPfNU/KjrNmtYY+P1iAT4o+PXmNLq8jJINomI60Jc=');
    });

    it('rejects unsafe entry paths', async () => {
      const zipFilePath = upath.join(cacheDir.path, 'unsafe-path.zip');
      await writeZip(zipFilePath, (archive) => {
        archive.addBuffer(Buffer.from('provider content'), 'aa/outside.txt');
      });

      const zip = await readFile(zipFilePath);
      expect(replaceZipEntryName(zip, 'aa/outside.txt', '../outside.txt')).toBe(
        2,
      );
      await writeFile(zipFilePath, zip);

      await expect(
        TerraformProviderHash.hashOfZipContent(zipFilePath),
      ).rejects.toThrow('invalid relative path');
    });

    it('isolates concurrent downloads that have the same filename', async () => {
      const fileName = 'provider.zip';
      const firstBuild = partial<TerraformBuild>({
        name: 'first',
        version: '1.0.0',
        filename: fileName,
        url: 'https://example.com/first/provider.zip',
      });
      const secondBuild = partial<TerraformBuild>({
        name: 'second',
        version: '1.0.0',
        filename: fileName,
        url: 'https://example.com/second/provider.zip',
      });
      vi.spyOn(TerraformProviderHash.http, 'stream')
        .mockReturnValueOnce(createReadStream(zipWithFolderPath))
        .mockReturnValueOnce(createReadStream(zipWithFolderPath));
      const createCacheWriteStream = vi.spyOn(fs, 'createCacheWriteStream');

      await expect(
        Promise.all([
          TerraformProviderHash.calculateSingleHash(firstBuild, cacheDir.path),
          TerraformProviderHash.calculateSingleHash(secondBuild, cacheDir.path),
        ]),
      ).resolves.toEqual([
        'g92f/mR2hlVmeWBlplxxJyP2H3fdyPwYccr7uJhcRz8=',
        'g92f/mR2hlVmeWBlplxxJyP2H3fdyPwYccr7uJhcRz8=',
      ]);

      const downloadFileNames = createCacheWriteStream.mock.calls.map(
        ([downloadFileName]) => downloadFileName,
      );
      expect(downloadFileNames).toHaveLength(2);
      expect(new Set(downloadFileNames).size).toBe(2);
      for (const downloadFileName of downloadFileNames) {
        expect(upath.dirname(downloadFileName)).toBe(cacheDir.path);
        expect(upath.basename(downloadFileName)).not.toBe(fileName);
        await expect(fs.cachePathExists(downloadFileName)).resolves.toBeFalse();
      }
    });

    it('closes the ZIP and removes the download after an entry stream error', async () => {
      const fileName = 'entry-stream-error.zip';
      const build = partial<TerraformBuild>({
        name: 'test',
        version: '1.0.0',
        filename: fileName,
        url: 'https://example.com/entry-stream-error.zip',
      });
      vi.spyOn(TerraformProviderHash.http, 'stream').mockReturnValue(
        createReadStream(zipWithFolderPath),
      );
      const createCacheWriteStream = vi.spyOn(fs, 'createCacheWriteStream');
      const close = vi.spyOn(yauzl.ZipFile.prototype, 'close');
      vi.spyOn(
        yauzl.ZipFile.prototype,
        'openReadStreamPromise',
      ).mockResolvedValue(
        new Readable({
          read() {
            this.destroy(new Error('entry stream failed'));
          },
        }),
      );

      await expect(
        TerraformProviderHash.calculateSingleHash(build, cacheDir.path),
      ).rejects.toThrow('entry stream failed');

      expect(close).toHaveBeenCalledOnce();
      expect(createCacheWriteStream).toHaveBeenCalledOnce();
      const downloadFileName = createCacheWriteStream.mock.calls[0][0];
      expect(upath.dirname(downloadFileName)).toBe(cacheDir.path);
      expect(upath.basename(downloadFileName)).not.toBe(fileName);
      await expect(fs.cachePathExists(downloadFileName)).resolves.toBeFalse();
    });
  });
});
