@description('Container Apps Environment name')
param envName string
@description('Location')
param location string
@description('Name prefix')
param namePrefix string
@description('Registry server')
param registryServer string

var services = [
  'catalog'
  'inference'
  'review-tasks'
  'operator-assistant'
]

resource caapps 'Microsoft.App/containerApps@2023-05-01' = [for svc in services: {
  name: '${namePrefix}-${svc}'
  location: location
  properties: {
    managedEnvironmentId: resourceId('Microsoft.App/managedEnvironments', envName)
    configuration: {
      registries: [
        {
          server: registryServer
        }
      ]
      ingress: {
        external: true
        targetPort: 8080
      }
    }
    template: {
      containers: [
        {
          name: svc
          image: '${registryServer}/vbic-${svc}:latest'
          probes: []
          env: [
            {
              name: 'ENVIRONMENT'
              value: 'prod'
            },
            {
              name: 'OTEL_EXPORTER_OTLP_ENDPOINT'
              value: 'https://otlp.azure.com:4317'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}]
