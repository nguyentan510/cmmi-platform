# CMMI implementation design

Source: user supplied architecture, 2026-10-16, preserved at `docs/supplied-plan.md`. The supplied plan and instruction to implement it authorize local implementation. Cloud provisioning, production migrations, publication and external credentials remain separate operations.

Build the specified monorepo: Python 3.12 / FastAPI / Poetry, SQLAlchemy 2 async / Alembic / PostgreSQL, Pydantic 2 contracts, R2 through boto3, APScheduler 3, React / Vite / TypeScript / Sass, Nginx and Cloudflare Tunnel. Contracts are exported without a database connection; frontend types are generated from that artifact.

Authentication uses expiring JWTs and hashed, scoped API keys. Creator queries and mutations are owner restricted; admins manage users, settings and all content. User activation and role are checked from the database on every authenticated request. No public registration; an explicit bootstrap command creates the first admin.

Uploads reserve a unique staging object key, return a 900 second signed PUT, and require server-side HEAD verification of size and MIME, followed by an ETag-conditioned copy to a separate canonical key before attachment. Re-confirmation is idempotent. Configure a `staging/` lifecycle rule to expire abandoned/replayed uploads after one day. Only confirmed, available media can be attached. HTML/SVG uploads are excluded. Contents use UTC-aware timestamps. Edits while PUBLISHED preserve the publication timestamp; each transition from another state to PUBLISHED stamps a fresh retention start, as required by the supplied plan. Channel identifiers default to empty strings. Scheduled content is exposed to automation, not automatically posted to social networks.

Cleanup retains metadata, clears public URLs only after successful deletion, retries failures, and protects shared media linked to drafts, scheduled items, recent publications or archived items. All linked contents must be published and old enough. Manual and scheduled cleanup share a database lock protocol with media attachment and publication updates. Run one application worker; PostgreSQL advisory lock also prevents concurrent cleanup across processes. SQLite is for isolated tests/development only.

Settings are a singleton with retention 1..365 days, validated five-field cron in UTC, last run/count and storage totals. Docker services expose no host ports; a separate development override supports loopback access. Migrations use a direct database URL when provided. No startup schema creation or implicit migration in production.

Verification uses disposable SQLite tests, a disposable PostgreSQL integration database if Docker is available, stubbed R2 responses (including partial failures), frontend interaction tests and a build, generated-contract drift checks and Docker config/build checks where supported. Live Neon/R2/Tunnel require user-provided service configuration.
