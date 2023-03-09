import { Fixtures } from './../../../../test/fixtures';
import { extractPackageFile } from '.';

const resourceCommentedOut = Fixtures.get('resource-commented-out.bicep');
const resourceConditional = Fixtures.get('resource-conditional.bicep');
const resourceExisting = Fixtures.get('resource-existing.bicep');
const resourceLoopConditional = Fixtures.get('resource-loop-conditional.bicep');
const resourceLoop = Fixtures.get('resource-loop.bicep');
const resourceNestedUnversioned = Fixtures.get(
  'resource-nested-unversioned.bicep'
);
const resourceNestedVersioned = Fixtures.get('resource-nested-versioned.bicep');
const resourceNormal = Fixtures.get('resource-normal.bicep');
const resourceSubresource = Fixtures.get('resource-subresource.bicep');

describe('modules/manager/bicep/extract', () => {
  it('should extract a normal resource', async () => {
    const result = await extractPackageFile(resourceNormal, '', {});

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
    const result = await extractPackageFile(resourceCommentedOut, '', {});

    expect(result).toEqual({
      deps: [],
    });
  });

  it('should extract a conditional resource', async () => {
    const result = await extractPackageFile(resourceConditional, '', {});

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
    const result = await extractPackageFile(resourceExisting, '', {});

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
    const result = await extractPackageFile(resourceLoopConditional, '', {});

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
    const result = await extractPackageFile(resourceLoop, '', {});

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
    const result = await extractPackageFile(resourceNestedUnversioned, '', {});

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
    const result = await extractPackageFile(resourceNestedVersioned, '', {});

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
    const result = await extractPackageFile(resourceSubresource, '', {});

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
