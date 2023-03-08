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
