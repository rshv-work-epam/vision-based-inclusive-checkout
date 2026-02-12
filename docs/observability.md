# Observability

- SDK: OpenTelemetry in each FastAPI app (traces, metrics, logs)
- Collector: local `observability/otel-collector-config.yaml` via docker-compose
- Prod: export OTLP to Azure Monitor (Application Insights)
- Context: propagate W3C traceparent across services
- Dashboards: use Azure Monitor Workbooks; optionally Grafana via Azure Managed Grafana
