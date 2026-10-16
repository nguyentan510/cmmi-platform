# Third-party components

The MIT license at the repository root covers CMMI's original source. It does not replace the licenses of third-party dependencies.

Dependencies are declared and locked in `backend/pyproject.toml`, `backend/poetry.lock`, `frontend/package.json` and `frontend/package-lock.json`. Python environments and Node dependencies are downloaded at installation/build time and are not vendored in this repository. Their license notices remain with their distributions.

Generated OpenAPI and TypeScript files describe CMMI's own API. Scalar/ReDoc documentation pages may load third-party frontend assets; those projects retain their respective licenses. Container base images and included operating-system packages retain their own licenses as well.
