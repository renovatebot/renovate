import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { AzureBicepResourceDatasource } from './index';

const gitHubHost = 'https://raw.githubusercontent.com';
const indexPath = '/Azure/bicep-types-az/main/generated/index.json';

describe('modules/datasource/azure-bicep-resource/index', () => {
  it('should return null when no version is found', async () => {
    httpMock
      .scope(gitHubHost)
      .get(indexPath)
      .reply(200, Fixtures.getJson('empty-index.json'));

    const azureBicepResourceDatasource = new AzureBicepResourceDatasource();
    const result = await azureBicepResourceDatasource.getReleases({
      packageName: 'unknown',
    });

    expect(result).toBeNull();
  });

  it('should return versions when package is a function', async () => {
    httpMock
      .scope(gitHubHost)
      .get(indexPath)
      .reply(200, Fixtures.getJson('function-billingaccount-index.json'));

    const azureBicepResourceDatasource = new AzureBicepResourceDatasource();
    const result = await azureBicepResourceDatasource.getReleases({
      packageName: 'Microsoft.Billing/billingAccounts',
    });

    expect(result).toEqual({
      releases: [
        {
          version: '2019-10-01-preview',
          changelogUrl:
            'https://learn.microsoft.com/en-us/azure/templates/microsoft.billing/change-log/billingaccounts#2019-10-01-preview',
        },
        {
          version: '2020-05-01',
          changelogUrl:
            'https://learn.microsoft.com/en-us/azure/templates/microsoft.billing/change-log/billingaccounts#2020-05-01',
        },
      ],
    });
  });

  it('should return versions when package is a resource', async () => {
    httpMock
      .scope(gitHubHost)
      .get(indexPath)
      .reply(200, Fixtures.getJson('resource-storageaccount-index.json'));

    const azureBicepResourceDatasource = new AzureBicepResourceDatasource();
    const result = await azureBicepResourceDatasource.getReleases({
      packageName: 'Microsoft.Storage/storageAccounts',
    });

    expect(result).toEqual({
      releases: [
        {
          version: '2015-05-01-preview',
          changelogUrl:
            'https://learn.microsoft.com/en-us/azure/templates/microsoft.storage/change-log/storageaccounts#2015-05-01-preview',
        },
        {
          version: '2018-02-01',
          changelogUrl:
            'https://learn.microsoft.com/en-us/azure/templates/microsoft.storage/change-log/storageaccounts#2018-02-01',
        },
      ],
    });
  });
});
