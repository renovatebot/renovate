import { createReadStream } from 'node:fs';
import { DirectoryResult, dir } from 'tmp-promise';
import { Fixtures } from '../../../../../test/fixtures';
import * as httpMock from '../../../../../test/http-mock';
import { getFixturePath, logger } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { Logger } from '../../../../logger/types';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import { TerraformProviderHash } from './hash';

const releaseBackendUrl = TerraformProviderDatasource.defaultRegistryUrls[1];
const releaseBackendAzurerm = Fixtures.get('releaseBackendAzurerm_2_56_0.json');

const log = logger.logger as jest.Mocked<Logger>;

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
});
