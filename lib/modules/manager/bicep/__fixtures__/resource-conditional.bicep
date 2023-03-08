param location string = resourceGroup().location

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = if(0 == 1) {
  name: 'test'
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  location: location
}
