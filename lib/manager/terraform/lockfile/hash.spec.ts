import { createReadStream, readFileSync } from 'fs';
import * as httpMock from '../../../../test/http-mock';
import { getName } from '../../../../test/util';
import { defaultRegistryUrls } from '../../../datasource/terraform-provider';
import createHashes from './hash';

jest.setTimeout(15000);

const releaseBackendUrl = defaultRegistryUrls[1];
const releaseBackendAzurerm = readFileSync(
  'lib/manager/terraform/lockfile/__fixtures__/releaseBackendAzurerm_2_56_0.json',
  'utf8'
);

describe(getName(), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  it('returns null if a non hashicorp release is found ', async () => {
    const result = await createHashes(
      'test/gitlab',
      '2.56.0',
      '/tmp/renovate/cache'
    );
    expect(result).toBeNull();
  });

  it('return null if requesting a version which is not available', async () => {
    httpMock
      .scope(releaseBackendUrl)
      .get('/terraform-provider-azurerm/2.59.0/index.json')
      .reply(403, '');

    const result = await createHashes(
      'hashicorp/azurerm',
      '2.59.0',
      '/tmp/renovate/cache'
    );
    expect(result).toBeNull();
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
      'hashicorp/azurerm',
      '2.56.0',
      //      '/tmp/renovate/cache',
      '/tmp'
    );
    expect(result).not.toBeNull();
    expect(result).toBeArrayOfSize(2);
    expect(result).toMatchSnapshot();
  });
});
