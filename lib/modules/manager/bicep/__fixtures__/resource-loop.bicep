param location string = resourceGroup().location

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = [for name in ['test', 'test2']: {
  name: name
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  location: location
}]
