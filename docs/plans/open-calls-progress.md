# Open calls implementation checkpoint

- Approved: first-class database records, admin management and reusable CMS component; production
  schema/data migration authorised. No frontend release, hook deployment, commit or push authorised.
- Production schema `open_calls` created and both thematic calls copied with deadlines and edition
  references. Record, permission/schema and anonymous published-read readbacks succeeded.
- Fresh verified backup: `open-calls-before-1792587133172.zip` (PocketBase backup store; private local
  downloaded copy outside the checkout, ZIP integrity checked). Independently extracted its
  application database and ran SQLite `PRAGMA integrity_check`: `ok`; `content` table confirmed.
- Original production `content` guide `calls` is intentionally unchanged until supporting frontend
  and hooks are deployed. Migration supports a subsequent `--apply --link-page` run.
- New migration/schema scripts and `docs/open-calls.md` are implemented. `setupCms` now ensures the
  new collection for installations. Preserve pre-existing changes in `scripts/cms-schema.ts`.
- Admin CRUD, editor selection/serialisation, sanitisation, public record resolution and backend
  validation are implemented and reviewed. Open-call bodies cannot recursively embed open calls.
- Local preview is running at `http://127.0.0.1:60026/admin/open-calls`. A task-isolated browser used
  simulated client-side admin state with all API writes blocked and anonymous published-data reads.
  The list rendered both real published calls; opening the first editor showed its correct title,
  deadline and preserved edition grid. This does not verify an authenticated save journey.
- Worker checks passed: Svelte compilation of changed components, hook syntax, focused component
  validation assertions, diff whitespace. Scoped lint has a pre-existing admin-layout navigation
  diagnostic. No full typecheck/build or authenticated CRUD/browser save test was run.
- Next requires explicit authorisation: final quality gates, production hook/frontend deployments,
  then `--apply --link-page`. Do not deploy or change the existing production page prematurely.
