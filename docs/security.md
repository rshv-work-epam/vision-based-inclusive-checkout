# Security

- Identities: Deployments use GitHub OIDC; runtime uses Managed Identity (future)
- Secrets: Prefer Key Vault / workload identities; avoid storing secrets in repo
- Images: Build with pinned versions; enable image scanning in ACR
- Network: Restrict ingress; TLS termination via ACA; private ACR access
- Dependencies: Update regularly; use Dependabot (optional)
