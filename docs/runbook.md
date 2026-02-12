# Runbook

- Access: Azure Portal -> Resource Group with `vbic` resources
- Rollout: push to `main` triggers CD; or run `CD` workflow manually
- Health: check `/health` on each service; logs in Log Analytics
- Incidents: capture trace IDs; correlate across services via Application Insights
- Recovery: rollback by redeploying previous image tag
