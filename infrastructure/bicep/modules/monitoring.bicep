@description('Deployment location')
param location string
@description('Name prefix')
param namePrefix string

resource la 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namePrefix}-law'
  location: location
  properties: {
    retentionInDays: 30
    features: {
      legacy: 0
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
  sku: {
    name: 'PerGB2018'
  }
}

resource laSharedKeys 'Microsoft.OperationalInsights/workspaces/sharedKeys@2020-08-01' existing = {
  name: la.name
}

output laId string = la.id
output laCustomerId string = la.properties.customerId
output laSharedKey string = laSharedKeys.properties.primarySharedKey
