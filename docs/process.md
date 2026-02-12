# Engineering Process

- Trunk-based development with short-lived feature branches
- CI: per-service tests and image builds on PRs and main
- CD: Bicep infra and image rollout to Azure using OIDC
- Code quality: type hints encouraged, linting/formatting via pre-commit (optional)
- Testing: pytest unit tests for FastAPI routers and core logic
- Security: dependency updates, secrets scanning, OIDC-based deploy, minimal privileges
