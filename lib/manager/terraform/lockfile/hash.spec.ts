import { createReadStream } from 'fs';
import { DirectoryResult, dir } from 'tmp-promise';
import * as httpMock from '../../../../test/http-mock';
import {
  getFixturePath,
  getName,
  loadFixture,
  logger,
} from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import { Logger } from '../../../logger/types';
import { createHashes } from './hash';

const releaseBackendUrl = TerraformProviderDatasource.defaultRegistryUrls[1];
const releaseBackendAzurerm = loadFixture('releaseBackendAzurerm_2_56_0.json');

const log = logger.logger as jest.Mocked<Logger>;

describe(getName(), () => {
  let cacheDir: DirectoryResult;

  beforeAll(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    setAdminConfig({ cacheDir: cacheDir.path });
  });

  beforeEach(() => jest.resetAllMocks());

  afterAll(() => cacheDir.cleanup());

  it('returns null if getBuilds returns null', async () => {
    httpMock
      .scope('https://example.com')
      .get('/.well-known/terraform.json')
      .reply(200, '');
    const result = await createHashes(
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

    const result = await createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.59.0'
    );
    expect(result).toBeNull();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('backend index throws error', async () => {
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.56.0/index.json')
      .replyWithError('');

    const result = await createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0'
    );
    expect(result).toBeNull();
    expect(httpMock.getTrace()).toMatchSnapshot();
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

    const result = await createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0'
    );
    expect(result).toBeNull();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('full walkthrough', async () => {
    const readStreamLinux = createReadStream(
      'lib/manager/terraform/lockfile/__fixtures__/test.zip'
    );
    const readStreamDarwin = createReadStream(
      'lib/manager/terraform/lockfile/__fixtures__/test.zip'
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

    const result = await createHashes(
      'https://releases.hashicorp.com',
      'hashicorp/azurerm',
      '2.56.0'
    );
    expect(log.error.mock.calls).toMatchSnapshot();
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(2);
    expect(result).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
