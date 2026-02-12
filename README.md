# Vision-based Inclusive Checkout (VBIC)

A production-style reference system for **accessible self-checkout** powered by computer vision.

VBIC helps shoppers scan products with a camera, receive product predictions, and continue checkout independently. When confidence is low or the model is uncertain, VBIC creates a human-review task so staff can quickly assist without blocking the user experience.

---

## Why this exists

Traditional self-checkout often assumes perfect barcode scans and perfect mobility/vision conditions. VBIC is designed for real people and real environments:

- **Inclusive UX**: clear feedback, predictable workflows, and accessible controls.
- **Human-in-the-loop safety**: low-confidence predictions move to review queue.
- **Operational visibility**: every service exposes health probes and telemetry.
- **Cloud-ready architecture**: designed for Azure Container Apps with OpenTelemetry.

---

## What you get

VBIC is split into small services:

- **Inference service** (`:8002`) – predicts products from uploaded images.
- **Review Tasks service** (`:8003`) – stores and lists tasks for manual review.
- **Catalog service** (`:8001`) – catalog-facing backend service and health probes.
- **Operator Assistant service** (`:8004`) – tools for operational support.
- **Web UI** (`:3000`) – dashboard + recognition flow + review queue.
- **OpenTelemetry Collector** (`:4317/:4318`) – central telemetry pipeline.

---

## Quick start (local)

### 1) Start everything

```bash
cp .env.example .env || true
docker compose up --build -d
```

### 2) Open the UI

- Main app: http://localhost:3000

### 3) Verify service health

- Catalog: http://localhost:8001/healthz
- Inference: http://localhost:8002/healthz
- Review Tasks: http://localhost:8003/healthz
- Operator Assistant: http://localhost:8004/healthz

---

## End-user walkthrough (real usage)

1. Open **Recognize** in the UI.
2. Upload a product image from kiosk camera or local file.
3. Click **Recognize**.
4. Review model output (label, confidence, bounding box).
5. If prediction quality is uncertain, click **Create Review Task**.
6. Staff can monitor and process items in **Review Queue**.

This provides autonomy for shoppers while preserving safety and support for edge cases.

---

## UX and CX principles applied

- Clear status labels for service health (healthy/attention needed).
- Friendly empty states and error states.
- Progressive disclosure of advanced JSON output.
- Manual review path built directly into recognition flow.
- Visual hierarchy optimized for at-a-glance operations.

---

## Engineering best practices

VBIC aligns with common Well-Architected themes:

- **Reliability**
  - Health/readiness/liveness probes for each service.
  - Degraded-mode signaling in dashboard.
  - Human-review fallback for uncertain ML outputs.
- **Operational Excellence**
  - Trace-friendly microservices with OpenTelemetry instrumentation.
  - Runbook and process docs for incident handling.
- **Security**
  - Security controls documented in ADRs and `docs/security.md`.
  - Cloud deployment via OIDC-enabled CI/CD.
- **Performance Efficiency**
  - Parallel health checks in the dashboard.
  - Lightweight service boundaries for targeted scaling.
- **Cost Optimization**
  - Containerized deployment model for right-sized scaling.
  - Decoupled services to scale only where needed.

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/well-architected.md](docs/well-architected.md)
- [docs/observability.md](docs/observability.md)
- [docs/security.md](docs/security.md)
- [docs/runbook.md](docs/runbook.md)

---

## Developer workflow

### Run tests per service

```bash
PYTHONPATH=services/catalog pytest -q services/catalog/tests
PYTHONPATH=services/inference pytest -q services/inference/tests
PYTHONPATH=services/review-tasks pytest -q services/review-tasks/tests
PYTHONPATH=services/operator-assistant pytest -q services/operator-assistant/tests
```

### Build the UI

```bash
npm --prefix web/ui run build
```

---

## Deployment (Azure)

The `CD` workflow deploys infrastructure and images to Azure Container Apps.

Required repository secrets:

- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `ACR_NAME`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `ACR_USERNAME`
- `ACR_PASSWORD`

Manual infrastructure deployment:

```bash
az group create -n <rg> -l <location>
az deployment group create -g <rg> \
  -f infrastructure/bicep/main.bicep \
  -p @infrastructure/bicep/parameters/main.parameters.json \
  -p acrName=<your_acr_name>
```

---

## Additional documentation

- System architecture: [docs/architecture.md](docs/architecture.md)
- Development process: [docs/process.md](docs/process.md)
- Architectural decisions: [docs/adr](docs/adr)
