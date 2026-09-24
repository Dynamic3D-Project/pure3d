# PocketBase script inventory

## Supported setup and import

`make install` and the Compose `pocketbase-setup` service run:

1. `scripts/create-pocketbase-collections.ts` — canonical additive schema setup,
   with stored field identity preservation and explicit-migration guards.
2. `scripts/migrate-documentation.ts` — current CMS schema/content setup.
3. `scripts/import-data.ts` — legacy JSON import with current collections, credits
   and deferred author onboarding. Local Compose also seeds synthetic demo users.

`scripts/read-bson.ts` converts retained MongoDB backups for that importer. It is
still referenced by the README and setup guides. Keep original backups, inspect
the target configuration and never run imports as a verification step.

The `migrate-*` scripts, ORCID configuration/reconciliation tools, WordPress import,
schema import/export, asset conversion and read-only inspection utilities remain
separate explicit maintenance commands. They are not interchangeable with fresh
setup. Review their prerequisites and target environment before running them.

## Removed superseded entry points

The repository, Compose files, package scripts and setup documentation were checked
for callers before retiring these implementations:

| Removed entry point                                                                                        | Reason / replacement                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup-pocketbase-complete.ts`, its `.backup`, `setup-pocketbase-complete-v3.ts`, `setup-pocketbase-v2.ts` | Early schema/import experiments, including collection deletion/recreation. Use the canonical setup/import chain above.                                               |
| `setup-pocketbase-http.ts`, `setup-pocketbase-simple.ts`                                                   | Old bootstrap probes using retired schemas/APIs. Use `make install`; account recovery uses the admin UI or PocketBase CLI, not setup.                                |
| `import-to-pocketbase.ts`, `import-to-pocketbase-docker.ts`                                                | Old admin API and `projects`/membership model; superseded by `import-data.ts`.                                                                                       |
| `fix-pocketbase-schema.ts`, `update-projects-schema.ts`, `debug-pocketbase.ts`                             | Target retired `projects` schema; canonical schema setup and the current admin UI replace them.                                                                      |
| `cleanup-duplicates.ts`                                                                                    | Unreferenced title-based deletion cannot distinguish legitimate editions. No automatic replacement: record deletion requires an explicit, reviewed data-repair plan. |

Removal affects source entry points only. No database, credentials, imported data,
asset paths or live service configuration were changed. Historical implementations
remain available in Git history; do not restore and run them on a current database.
