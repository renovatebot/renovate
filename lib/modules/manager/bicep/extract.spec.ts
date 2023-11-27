import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/bicep/extract', () => {
  it('should extract a normal resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      param location string = resourceGroup().location

      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
        name: 'test'
        kind: 'StorageV2'
        sku: {
          name: 'Standard_LRS'
        }
        location: location
      }
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should not extract a commented out resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      // param location string = resourceGroup().location

      // resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
      //   name: 'test'
      //   kind: 'StorageV2'
      //   sku: {
      //     name: 'Standard_LRS'
      //   }
      //   location: location
      // }
      `,
      '',
      {},
    );

    expect(result).toBeNull();
  });

  it('should extract a conditional resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      param location string = resourceGroup().location

      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = if(0 == 1) {
        name: 'test'
        kind: 'StorageV2'
        sku: {
          name: 'Standard_LRS'
        }
        location: location
      }
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should extract a existing resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' existing = {
        name: 'test'
      }

      output id string = storageAccount.id
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should extract a conditional loop resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      param location string = resourceGroup().location

      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = [for name in ['test', 'test2']: if(42 == 'the answer') {
        name: name
        kind: 'StorageV2'
        sku: {
          name: 'Standard_LRS'
        }
        location: location
      }]
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should extract a loop resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      param location string = resourceGroup().location

      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = [for name in ['test', 'test2']: {
        name: name
        kind: 'StorageV2'
        sku: {
          name: 'Standard_LRS'
        }
        location: location
      }]
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should not extract a nested unversioned resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      param location string = resourceGroup().location

      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
        name: 'test'
        kind: 'StorageV2'
        sku: {
          name: 'Standard_LRS'
        }
        location: location

        resource blobServices 'blobServices' = {
          name: 'default'
        }
      }
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should not extract a nested versioned resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      param location string = resourceGroup().location

      resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
        name: 'test'
        kind: 'StorageV2'
        sku: {
          name: 'Standard_LRS'
        }
        location: location

        resource blobServices 'blobServices@2022-09-01' = {
          name: 'default'
        }
      }
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts',
          replaceString: "'Microsoft.Storage/storageAccounts@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });

  it('should extract a sub resource', async () => {
    const result = await extractPackageFile(
      codeBlock`
      resource storageAccount 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
        name: 'parent/child/this'
      }
      `,
      '',
      {},
    );

    expect(result).toEqual({
      deps: [
        {
          autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
          currentValue: '2022-09-01',
          datasource: 'azure-bicep-resource',
          depName: 'Microsoft.Storage/storageAccounts/blobServices/containers',
          replaceString:
            "'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01'",
          versioning: 'azure-rest-api',
        },
      ],
    });
  });
});
