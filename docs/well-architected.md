# Well-Architected

- Reliability: health probes, conservative autoscaling, retry policies at clients
- Security: least privilege, container image scanning, network isolation where possible
- Cost: basic ACR + Container Apps; scale-to-zero possible for non-critical services
- Performance: inference model optimized (batching, ONNX), async endpoints
- Operational Excellence: runbook, alerts in Azure Monitor, SLOs for p95 latency
- Sustainability: minimal footprint, shared observability infra, right-sized compute
