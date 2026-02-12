@description('Deployment location')
param location string
@description('Name prefix')
param namePrefix string
@description('Log Analytics workspace customer ID')
param logAnalyticsCustomerId string
@description('Log Analytics workspace shared key')
param logAnalyticsSharedKey string
@description('ACR login server, e.g., myacr.azurecr.io')
param registryServer string

resource dapr 'Microsoft.Web/containerAppsDaprComponents@2023-05-01' existing = {
  name: 'none'
}

resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${namePrefix}-cae'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
}

@description('Create four Container Apps with image placeholders')
module apps 'modules/containerapps.apps.bicep' = {
  name: 'containerapps-apps'
  params: {
    envName: env.name
    location: location
    namePrefix: namePrefix
    registryServer: registryServer
  }
}

output envName string = env.name
