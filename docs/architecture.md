# Architecture

This repository implements a microservices-based system for Vision-based Product Recognition for Inclusive Self-Service Checkout.

- Services: inference (ML prediction), catalog (SKUs), review-tasks (operator queue), operator-assistant (tools for human operators)
- Communication: HTTP/JSON via REST; future: async events (e.g., Azure Service Bus)
- Deployment: Docker locally; Azure Container Apps in cloud
- Observability: OpenTelemetry SDKs export to OTLP via Collector; Azure Monitor in production
- Configuration: Environment variables with sane defaults; 12-factor principles

See docs/well-architected.md for cross-cutting concerns.
