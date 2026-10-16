# Public-source publication audit — 2026-10-16

Scope: the source snapshot prepared for the initial public GitHub repository, including application code, dependency locks, documentation and deployment definitions. This is not a production penetration test or a security certification.

## Findings and remediation

- Gitleaks 8.30.1 scanned the candidate public file snapshot with redacted output: no secrets detected.
- A separate comparison checked actual sensitive values from the ignored local `.env` against candidate source files without logging their values: no credential matches. A local SQLite URL was initially treated as sensitive by the broad URL matcher; credential-aware matching correctly excludes URLs without embedded passwords.
- `.env`, virtual environments, local databases, Node dependencies, build output, browser traces and local agent execution records are excluded. Only placeholder `.env.example` is published. The repository had no prior commits or remote history to expose.
- Bandit 1.9.4 scanned `backend/app`: no findings across 1,232 lines; no tests suppressed with `nosec`.
- `npm audit` reported no known vulnerabilities across production and development dependencies.
- `pip-audit` initially flagged pytest 8.4.2 for GHSA-6w46-j5rx-g56g / CVE-2025-71176 (development dependency, vulnerable temporary-directory handling). The failing advisory check was observed before changing the dependency. Pytest was upgraded to 9.1.1 and the lockfile regenerated; a subsequent audit of all 58 locked Python packages reported no known vulnerabilities.
- Independent source review found no confirmed critical/high/important issue blocking public source publication. Reviewed authentication, current-user activation, RBAC/ownership, API-key scopes, media confirmation/deletion, cleanup locking, browser token handling and deployment/CI boundaries.
- Credential-issuing scopes (`keys:write`, `users:write`), independent child-key expiry/revocation and JWT password-reset limitations are documented in [SECURITY.md](../SECURITY.md), rather than implied to have stronger guarantees.

## Publication preparation

- MIT license selected explicitly by the project owner. License metadata added to both packages; third-party licenses remain applicable.
- `SECURITY.md`, `CONTRIBUTING.md` and `NOTICE.md` added; setup instructions made portable for a public clone.
- Git author uses the owner's GitHub noreply identity. No private email address is included in the initial commit metadata.
- Final staged snapshot and initial Git history will be scanned before the first push. Publication and GitHub Actions outcomes are checked separately from local source verification.

## Verification status

- Current frontend: 8 tests passed, production TypeScript/Vite build passed, generated client matches the OpenAPI contract.
- Backend after upgrading to pytest 9.1.1: **33 tests and 6 subtests passed**, exit 0. Independent review also verified the original 33-test suite and Ruff before remediation.
- Poetry lock validation and generated OpenAPI drift checks passed. Poetry emits metadata deprecation warnings; they do not invalidate the lockfile or affect the application.
- Docker Compose configurations validated by tests without a running Docker Engine.

## Limits

No real Neon database, R2 object, Cloudflare Tunnel or production environment was changed during this audit. Local Docker Engine/container execution and live cloud integration remain separate acceptance work. GitHub CI is configured to verify PostgreSQL migrations/integration tests, container builds and browser flows after publication; its actual result must be read from the run, not inferred from this document.
