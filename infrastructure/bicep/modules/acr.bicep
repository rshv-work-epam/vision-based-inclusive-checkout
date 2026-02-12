@description('Deployment location')
param location string
@description('Registry name')
param registryName string
@description('SKU (Basic/Standard/Premium)')
param sku string = 'Basic'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: true
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
    }
  }
}

output loginServer string = acr.properties.loginServer
