# CMMI acceptance record — 2026-10-16

Historical record of the initial local implementation, before GitHub publication. Current publication checks and subsequent CI status are recorded in [PUBLICATION_AUDIT.md](PUBLICATION_AUDIT.md) and GitHub Actions.

## Implemented

All four local delivery areas in the supplied roadmap have code: contracts/migrations, core API/R2/cron, React/Sass administration, Docker/Nginx/Tunnel configuration and operations documentation.

## Verified locally

- Backend: **33 tests passed** in the final full run, including real boto3 signing, conditional copy parameters, 1000-object batching and partial-failure handling through botocore Stubber.
- Frontend: **8 user-interaction tests passed**; TypeScript + Vite production build passed after the final changes.
- Generated OpenAPI export and generated TypeScript drift checks passed.
- Poetry lock installation succeeded; pip dependency consistency check passed.
- `npm audit`: zero vulnerabilities after upgrading build/test tools to Vite 8 and Vitest 5.
- Production Compose config and opt-in loopback override both validated using Docker Compose CLI; production config publishes no ports.
- SQLite migration upgrade, bootstrap refusal of repeated admin initialization, Alembic schema check and downgrade executed against disposable databases.
- PostgreSQL rollback SQL verified to drop migration-owned enums. Actual PostgreSQL roundtrip is not yet verified locally.

## Final review and browser checks

- Independent review verified the upload replay and PostgreSQL enum fixes, with 2 focused regressions passing; no additional confirmed critical/important findings.
- Browser acceptance against a real local API: **1 passed** in the final run, covering login, persisted content creation/editing, scheduling/calendar, one-time keys, settings, in-app help and mobile navigation. Mobile body and root widths both verified at 390px. No browser page errors observed. Desktop/mobile screenshots visually inspected.
- Mobile overflow regression: an absolutely positioned screen-reader label escaped the table scroll container (695px root on a 390px viewport). Making the scroll wrapper a positioned containing block fixed the reproduced failure.
- Help navigation regression: a native link reloaded the page and lost the in-memory session. Unit and real-browser tests reproduced it; internal navigation now retains the session.
- Final Ruff lint and Python compilation succeeded; generated OpenAPI and frontend types are current; npm audit reports zero vulnerabilities.

## Known bounded UI limitation

- When changing attachments on historical content containing cleaned media, remove cleaned selections before attaching new files. Unchanged attachments permit ordinary title/body/channel edits. New cleaned attachments remain rejected by the API.

## Environment and deployment limits

- Docker CLI is installed but Docker Engine is not running (`docker_engine` pipe unavailable). Container build/start and Nginx runtime have not been verified locally.
- No local PostgreSQL binaries detected. CI defines a disposable PostgreSQL service; CI has not been published or run.
- No Neon/R2/Tunnel credentials were provided. No actual cloud provisioning, migration, object transfer/deletion, tunnel creation or public deployment occurred.
- R2 protocol paths use controlled fakes in HTTP integration tests and the real boto3 client with botocore Stubber/local URL signing in adapter tests. Live R2 still requires domain/CORS/token/lifecycle configuration.
- No claim of production readiness or deployment is made by passing local tests.
