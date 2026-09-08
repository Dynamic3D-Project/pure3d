# Local Setup From Scratch

Start an isolated development stack without losing legacy authorship intent. This is **local
provisioning**, not a production migration or an automatic ORCID rollout. For existing data and
author access, follow [ORCID migration and onboarding](../orcid.md).

## Prerequisites

- Docker with Compose and Bun installed.
- Protected local superuser credentials in the environment/configuration; never commit `.env`.
- Optional legacy source JSON in `data/json-output/`. If conversion is needed, run
  `bun scripts/read-bson.ts` against the intended local `data/db/` backup first and retain originals.
- For ORCID sandbox testing, separate sandbox credentials/database, with
  `ORCID_ISSUER=https://sandbox.orcid.org` on PocketBase and `ORCID_ENVIRONMENT=sandbox` for operator commands.

## Start the Stack

```sh
docker compose up -d
```

The active compose services provision local storage, bootstrap PocketBase through the superuser,
apply the local schema/documentation setup, import available source JSON, install Voyager assets,
and start the frontend. They **do not seed demo/password application accounts**. The obsolete
`scripts/seed-users.js` has been removed. Imported users are unverified onboarding records, not
demo credentials you can use to sign in.

Do not delete `pocketbase/pb_data` or existing volumes to work around an error. To rehearse from an
empty database, use a separately provisioned disposable workspace/data directory, preserving any
existing database and backups. Never point this bootstrap chain at production.

## Verify Provisioning

- Frontend: `http://localhost:60020`.
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
