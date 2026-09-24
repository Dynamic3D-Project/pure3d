# Recover local PocketBase superuser access

Do not delete `pocketbase/pb_data` to fix an authentication problem. It contains
the database and uploaded files. Take and verify a backup before account recovery.
These instructions apply only to the local Docker stack, not production.

If you can sign in at <http://localhost:60021/_/>, manage the superuser there and
keep `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` in your local `.env`
consistent with that account. Never commit credentials.

If you cannot sign in, an authorized local operator can reset the configured
superuser using PocketBase's CLI. Confirm the target email in `.env` first; an
incorrect email creates another privileged account rather than recovering yours.
Recreate the container to load any changed environment values, then explicitly
run the recovery command:

```sh
docker compose up -d --force-recreate pocketbase
docker compose exec pocketbase sh -c 'pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" --dir=/pb/pb_data'
```

The variables expand inside the container rather than putting literal credentials
in shell history. Do not share command output or container environment dumps.
Verify access by signing in to the local admin UI. Account recovery does not
require schema setup or a data import.

For a fresh installation, use `make install`; see [the script inventory](scripts.md)
for the supported schema/import entry points.
