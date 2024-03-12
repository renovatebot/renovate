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
            "resources": {},
            "resourceFunctions": {}
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
            "resources": {},
            "resourceFunctions": {
              "microsoft.billing/billingaccounts": {
                "2019-10-01-preview": [
                  {
                    "$ref": "billing/microsoft.billing/2019-10-01-preview/types.json#/304"
                  }
                ],
                "2020-05-01": [
                  {
                    "$ref": "billing/microsoft.billing/2020-05-01/types.json#/287"
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
            "resources": {
              "Microsoft.Storage/storageAccounts@2015-05-01-preview": {
                "$ref": "storage/microsoft.storage/2015-05-01-preview/types.json#/31"
              },
              "Microsoft.Storage/storageAccounts@2018-02-01": {
                "$ref": "storage/microsoft.storage/2018-02-01/types.json#/85"
              }
            },
            "resourceFunctions": {}
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
