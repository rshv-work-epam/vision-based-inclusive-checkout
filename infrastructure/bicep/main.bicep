@description('Deployment location')
param location string

@description('Azure Container Registry name (global unique)')
param acrName string

@description('Project name prefix')
param project string = 'vbic'

@description('Environment name (dev|prod)')
param environment string = 'dev'

var namePrefix = '${project}-${environment}'

// Log Analytics workspace
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    namePrefix: namePrefix
  }
}

// Application Insights (connected to LAW)
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    WorkspaceResourceId: monitoring.outputs.laId
  }
}

// Azure Container Registry
module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    location: location
    registryName: acrName
    sku: 'Basic'
  }
}

// Container Apps environment
module ca 'modules/containerapps.bicep' = {
  name: 'containerapps'
  params: {
    location: location
    namePrefix: namePrefix
    logAnalyticsCustomerId: monitoring.outputs.laCustomerId
    logAnalyticsSharedKey: monitoring.outputs.laSharedKey
    registryServer: '${acrName}.azurecr.io'
  }
}

output appInsightsConnectionString string = appInsights.properties.ConnectionString
