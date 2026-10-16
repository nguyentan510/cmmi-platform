# Security policy

CMMI is pre-release infrastructure. The `main` branch is the currently maintained version; there is no security support guarantee for older snapshots.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/nguyentan510/cmmi-platform/security/advisories/new). Include affected commit/version, reproduction steps, expected and actual behavior, and impact. Use disposable accounts, databases and media for a reproduction.

Do not post credentials, private media, database exports or exploitable vulnerability details in public issues. If private reporting is unavailable, ask the maintainer for a private reporting channel without disclosing the vulnerability publicly.

## Deployment requirements

- Keep `.env`, credentials, local databases, browser traces and uploaded assets out of Git. `.env.example` contains placeholders only. Rotate a credential if it has been exposed; removing a file does not revoke it.
- Set `ENVIRONMENT=production`, a random `SECRET_KEY` of at least 32 characters, PostgreSQL/TLS URLs and complete R2 configuration. Do not deploy example credentials. Use separate Neon branches/databases and buckets for development and production.
- The default Compose configuration exposes no host ports. Route Cloudflare Tunnel to the frontend/Nginx service so login rate limiting and same-origin API access apply. The development override binds only loopback.
- Use one backend worker. Cleanup and mutation use PostgreSQL transaction locks, but scheduler ownership and schedule updates are designed for one process.
- Restrict each R2 token to the intended bucket. Configure exact browser CORS origins and a lifecycle rule that expires only `staging/` objects after one day. Never apply an unconditional lifecycle deletion rule to the entire bucket.
- JWTs remain in browser memory and expire. Every authenticated request checks the user's current role and activation state. Disabling a user or revoking an API key blocks subsequent requests. Password changes alone do not revoke already issued JWTs; deactivate the user and rotate the signing secret if a compromise requires broader session revocation.
- Use minimal API-key scopes and separate keys per integration. `keys:write` permits creating independent keys within the caller's scopes; child keys do not inherit the parent's expiry or revocation. Omit key-management scopes from ordinary agents (the default scopes omit them).
- Treat `users:write` as full administrative trust: it can create or promote administrators. Do not delegate it to routine publishing workflows.
- Confirmed media is public through the configured R2 domain. API ownership checks do not make public asset URLs private. Use this design for media intended to be public.
- Physical R2 deletion is permanent unless you retain an independent backup. Cleanup keeps metadata and protects shared references, but it is not a backup mechanism.

## Verification boundaries

Local tests and scanners are evidence for the cases they cover, not a security certification. Live cloud services, container images, deployment configuration and access policies require environment-specific verification. See [the publication audit](docs/PUBLICATION_AUDIT.md) and [initial acceptance record](docs/ACCEPTANCE.md).
