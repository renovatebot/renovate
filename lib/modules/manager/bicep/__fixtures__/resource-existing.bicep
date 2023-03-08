resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' existing = {
  name: 'test'
}

output id string = storageAccount.id
