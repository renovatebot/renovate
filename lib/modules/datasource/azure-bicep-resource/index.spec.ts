import { codeBlock } from 'common-tags';
import * as httpMock from '../../../../test/http-mock';
import { AzureBicepResourceDatasource } from './index';

const gitHubHost = 'https://raw.githubusercontent.com';
const indexPath = '/Azure/bicep-types-az/main/generated/index.json';

describe('modules/datasource/azure-bicep-resource/index', () => {
  it('should return null when no version is found', async () => {
    httpMock
      .scope(gitHubHost)
      .get(indexPath)
      .reply(
        200,
        codeBlock`
          {
            "Resources": {},
            "Functions": {}
          }
        `,
      );

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
      .reply(
        200,
        codeBlock`
          {
            "Resources": {},
            "Functions": {
              "microsoft.billing/billingaccounts": {
                "2019-10-01-preview": [
                  {
                    "RelativePath": "billing/microsoft.billing/2019-10-01-preview/types.json",
                    "Index": 307
                  }
                ],
                "2020-05-01": [
                  {
                    "RelativePath": "billing/microsoft.billing/2020-05-01/types.json",
                    "Index": 287
                  }
                ]
              }
            }
          }
        `,
      );

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
      .reply(
        200,
        codeBlock`
          {
            "Resources": {
              "Microsoft.Storage/storageAccounts@2015-05-01-preview": {
                "RelativePath": "storage/microsoft.storage/2015-05-01-preview/types.json",
                "Index": 31
              },
              "Microsoft.Storage/storageAccounts@2018-02-01": {
                "RelativePath": "storage/microsoft.storage/2018-02-01/types.json",
                "Index": 85
              }
            },
            "Functions": {}
          }
        `,
      );

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
