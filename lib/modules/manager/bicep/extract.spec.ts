import { Fixtures } from './../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/bicep/extract', () => {
  it('should extract a normal resource', async () => {
    const result = await extractPackageFile(
      Fixtures.get('resource-normal.bicep'),
      '',
      {}
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
      Fixtures.get('resource-commented-out.bicep'),
      '',
      {}
    );

    expect(result).toEqual({
      deps: [],
    });
  });

  it('should extract a conditional resource', async () => {
    const result = await extractPackageFile(
      Fixtures.get('resource-conditional.bicep'),
      '',
      {}
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
      Fixtures.get('resource-existing.bicep'),
      '',
      {}
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
      Fixtures.get('resource-loop-conditional.bicep'),
      '',
      {}
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
      Fixtures.get('resource-loop.bicep'),
      '',
      {}
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
      Fixtures.get('resource-nested-unversioned.bicep'),
      '',
      {}
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
      Fixtures.get('resource-nested-versioned.bicep'),
      '',
      {}
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
      Fixtures.get('resource-subresource.bicep'),
      '',
      {}
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
