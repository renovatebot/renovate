---
title: Bicep
description: Bicep dependencies support in Renovate
---

# Bicep

Renovate supports upgrading API versions in `resource` references.
Upgrading `module` versions is not supported.

## How it works

1. Renovate searches for `.bicep` files.
2. Renovate parses the files for `resource` types and API versions.
3. Renovate looks up the latest version in the [Azure/bicep-types-az](https://github.com/Azure/bicep-types-az) repository.

## Known issues

API version updates of nested resources are not supported.

The API version of the `blobServices` resource below for example, will not be upgraded:

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-05-01' = {
  name: 'test'
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  location: location

  resource blobServices 'blobServices@2022-05-01' = {
    name: 'default'
  }
}
```

## Future work

- Support [versioned nested resource](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/child-resource-name-type#within-parent-resource) API version upgrades.
- Support [module](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/modules) version upgrades.
  - [Public registry](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/modules#public-module-registry) module references.
  - [Private registry](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/modules#private-module-registry) module references.
  - [Template spec](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/modules#file-in-template-spec) module references.
  - [Module aliases](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/bicep-config-modules#aliases-for-modules) support.
