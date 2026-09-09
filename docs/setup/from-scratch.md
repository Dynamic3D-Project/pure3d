# Local Setup From Scratch

Start an isolated development stack without losing legacy authorship intent. This is **local
provisioning**, not a production migration or an automatic ORCID rollout. For existing data and
author access, follow [ORCID migration and onboarding](../orcid.md).

## Prerequisites

- Docker with Compose, Bun, and mkcert installed (`brew install mkcert` on macOS).
- Protected local superuser credentials in the environment/configuration; never commit `.env`.
- Optional legacy source JSON in `data/json-output/`. If conversion is needed, run
  `bun scripts/read-bson.ts` against the intended local `data/db/` backup first and retain originals.
- For local ORCID sign-in, reuse the existing real ORCID OAuth application and account with an
  isolated local database. Add `https://127.0.0.1:60020/api/oauth2-redirect` to its allowed callbacks;
  retain the existing OVH callback and application URL. No sandbox is needed.

## Start the Stack

```sh
make dev
```

The Make target selects the explicit local Compose configuration, regardless of production URLs
in `.env`. Use `make dev-prod` only for intentional access to live data; see
[development modes](../development.md).

Its `make dev-cert` prerequisite trusts the local mkcert CA and generates missing certificates
under ignored `.certs/`, covering `localhost`, `127.0.0.1`, and `::1`. Never share the CA private key.
Restart the browser if trust is not picked up. A custom `FRONTEND_PORT` needs its own exact ORCID
callback allowlist entry. Provider configuration remains an explicit host operation with the
real credentials; startup never applies it automatically.

The active compose services provision local storage, bootstrap PocketBase through the superuser,
apply the local schema/documentation setup, import available source JSON, install Voyager assets,
and start the frontend. They **do not seed demo/password application accounts**. The obsolete
`scripts/seed-users.js` has been removed. Imported users are unverified onboarding records, not
demo credentials you can use to sign in.

Do not delete `pocketbase/pb_data` or existing volumes to work around an error. To rehearse from an
empty database, use a separately provisioned disposable workspace/data directory, preserving any
existing database and backups. Never point this bootstrap chain at production.

## Verify Provisioning

- Frontend: `https://127.0.0.1:60020` (same-origin `/api` and `/assets` proxies).
- PocketBase operator UI: `http://localhost:60021/_/`, using protected **superuser** credentials.
- Review setup logs for imported/skipped records and pending author-assignment counts. Do not assume
  a fixed source count or that all membership grants completed.
- Review private `data/import-onboarding/edition-author-onboarding-*.json` reports. The importer
  preserves each deferred author assignment's original user hash, edition identifier and requested
  role, without fabricated verification or a role downgrade. Existing author memberships remain untouched.
- Imports with unresolved person creators remain draft/hidden. Anonymous browsing and author access
  are different states: successful provisioning does not prove ORCID sign-in or publication readiness.

## Complete Onboarding

Follow the [current ORCID procedure](../orcid.md): deploy the complete hooks, prepare identity fields
with `configure-orcid.ts --prepare` where needed, approve/read back exact pending account mappings,
then perform backup-gated provider cutover. Authors must authenticate with their real ORCID before
an administrator grants the reviewed author membership. Reports are private review artifacts, not
automatic permission grants.

Use the existing ORCID sign-in UI; there are no seeded demo logins. Keep superuser recovery access,
verify the registered callback and issuer, and test token revocation and readiness before any rollout.

For current stack commands and asset setup, see [README](../../README.md). For backups, reviewed
attribution migration, per-record audit results and unresolved-author handling, use
[ORCID operations](../orcid.md) rather than older bootstrap scripts or destructive reset instructions.
