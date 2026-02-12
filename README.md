# Vision-based Inclusive Checkout

Vision-based Product Recognition for Inclusive Self-Service Checkout — an ML-first backend with an accessible, beautiful UI for inclusive self-checkout. It features inference, catalog, review queue, and operator assistant services, with observability via OpenTelemetry and cloud-ready deployment on Azure.

## Idea & Scope
- Enable shoppers, including people with disabilities, to scan products using computer vision and complete checkout independently.
- Support human-in-the-loop via an operator assistant with simple tools for resolving edge cases.
- Provide clear visibility into system health with standardized health endpoints and tracing.

## Quickstart (Local)

1. Copy env example and start services:

```bash
cp .env.example .env || true
docker compose up --build -d
```

2. Services (probes):
- Catalog: http://localhost:8001/healthz
- Inference: http://localhost:8002/healthz
- Review Tasks: http://localhost:8003/healthz
- Operator Assistant: http://localhost:8004/healthz

3. UI Dashboard:
- Start and open: http://localhost:3000
- Shows live health for all services and a simple Operator Tools panel (echo/summarize stubs).

OpenTelemetry Collector listens on 4317/4318 and logs telemetry to console.

## Architecture & Docs
- System overview: [docs/architecture.md](docs/architecture.md)
- Process: [docs/process.md](docs/process.md)
- Well-Architected: [docs/well-architected.md](docs/well-architected.md)
- Observability: [docs/observability.md](docs/observability.md)
- Security: [docs/security.md](docs/security.md)
- Runbook: [docs/runbook.md](docs/runbook.md)
- ADRs: [docs/adr](docs/adr)

## Cloud Deployment (Azure)

CD workflow `CD` deploys Bicep infra and rolls out images to Azure Container Apps using OIDC. Provide repo secrets: `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_LOCATION`, `ACR_NAME`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `ACR_USERNAME`, `ACR_PASSWORD`.

Manual deploy of infra:

```bash
az group create -n <rg> -l <location>
az deployment group create -g <rg> \
	-f infrastructure/bicep/main.bicep \
	-p @infrastructure/bicep/parameters/main.parameters.json \
	-p acrName=<your_acr_name>
```

## Development
- Codespaces: `.devcontainer` config with Python tools and Docker-in-Docker
- Samples: see [data/samples](data/samples)
- Diploma (UA): see [diploma](diploma)

## UI Development
- App: [web/ui](web/ui)
- Tech: React + Vite + Tailwind CSS, served by Nginx with reverse proxy to backend services.
- Build locally:

```bash
docker compose build ui
docker compose up -d ui
open http://localhost:3000
```

In-container proxies:
- `/api/catalog/*` → `catalog:8080`
- `/api/inference/*` → `inference:8080`
- `/api/review-tasks/*` → `review-tasks:8080`
- `/api/operator-assistant/*` → `operator-assistant:8080`

All application code is in English; diploma content is in Ukrainian.
