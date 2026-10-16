# Contributing to CMMI

Thanks for contributing. Open an issue for a bug or a proposed change; report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Development

Follow [README.md](README.md) to install the Poetry-managed Python 3.12 backend and Node 24 frontend. Work on a branch and use disposable databases/media. Never run test fixtures against an existing user or production database.

For behavior changes, first add a relevant test and observe it fail, implement the smallest fix, then run affected checks. Keep changes focused and explain their effect and verification in the pull request.

Backend checks (from `backend/`):

```shell
poetry run pytest -q
poetry run ruff check app tests
poetry run export-schema --check
```

Frontend checks (from `frontend/`):

```shell
npm ci
npm test
npm run build
npm run check:api
npm audit
npm run test:e2e
```

When API contracts change, run `poetry run export-schema` in `backend/`, then `npm run generate:api` in `frontend/`, and commit both generated files. Do not hand-edit generated TypeScript types.

Some tests use the Docker Compose CLI without starting containers. Browser tests require Chromium (`npx playwright install chromium`), two free loopback ports and a Python environment containing backend dependencies. See the README for PostgreSQL integration test requirements.

## Pull requests

Describe the problem, resulting behavior, tests run and any deployment implications. Include screenshots for UI changes. Do not include `.env`, tokens, local database files, browser traces, uploaded media or unrelated generated artifacts.

By submitting a contribution, you agree it is available under the project's [MIT license](LICENSE). Dependencies retain their own licenses; do not add code or assets without compatible permissions and attribution.
