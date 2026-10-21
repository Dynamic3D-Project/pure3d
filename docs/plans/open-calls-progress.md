# Open calls implementation checkpoint

- Rollout issue created and read back in milestone **2.0 Fixes**:
  https://github.com/Dynamic3D-Project/pure3d/issues/100 (related to existing #98).
- Approved: first-class database records, admin management, reusable CMS component and landing-page
  section. User subsequently authorised deployment of everything and the optional thematic-call
  proposal selector. Finalisation and production hook/frontend release are now authorised.
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
- Initial worker checks passed: Svelte compilation of changed components, hook syntax, focused
  component validation assertions and diff whitespace. Coordinator corrected the pre-existing
  admin-layout navigation lint diagnostic; focused lint/format now pass. Final integrated
  typecheck/build and authenticated browser journeys remain pending below.
- Production optional `editions.proposalOpenCall` relation has been added and verified without
  changing existing fields, permissions or record count (115). Fresh ZIP/SQLite-verified backup:
  `proposal-open-call-before-1792589949191.zip`.
- Worker `ses_ea152c0d2ffekbE5bUHqZGaYCe` implements proposal selection, snapshots, review display,
  backend enforcement and focused integration coverage. Coordinator owns schema/migration scripts,
  CMS integration coverage, final checks and deployment. Do not concurrently alter worker files.
- Coordinator traced the HTTP 400 to the fixture's missing `proposal-review-service.cjs`, not stale
  relation metadata. Fixed fixture dependencies and removed the unnecessary duplicate schema setup.
  Also fixed and regression-tested first submissions after a saved draft's call expires; only
  previously submitted snapshots may retain a closed call. Native proposal/workflow selection:
  6 tests, 120 assertions passed; CMS lifecycle: 1 test, 19 assertions passed. Default suite:
  40 passed, 30 opt-in skips, 0 failures. Typecheck: 0 errors, 6 existing warnings; scoped lint passes.
- Real browser journeys on disposable local PocketBase now pass: CMS insert/save/reopen/public
  rendering, live record edit reflected in a referenced page, proposal selector default/filtering,
  autosave/reopen, full author UI submission, and assigned reviewer seeing frozen title/deadline
  after call closure/unpublication. Proposal control has no overflow at 1440/768/390px.
- Two feature commits were added/pushed concurrently by another actor (`d5b8277`, `26be779`).
  Preserve these; coordinator's remaining fix will be a new commit. Newer uncommitted Resources
  edits must remain untouched. Use an isolated local clone of the committed main snapshot for the
  canonical clean-main release; retain this checkout as the user's active working directory.
- CMS feature-level integration passes 19 assertions against disposable production-matched
  PocketBase 0.40.3 (image digest `ab3f2357cce7`) through a temporary executable adapter, with real
  admin/reader/anonymous API clients. Tests cover stale saves and referenced-call deletion guards
  in addition to public/draft visibility, live references, writes and recursive-component rejection.
- Independent read-only CMS security review completed; both actionable findings addressed and
  tested. Open-call writes now require the loaded record version; page editor and page migration
  send version headers. Calls referenced by pages or proposals cannot be deleted.
- Homepage browser probes passed at 1440, 768, 390 and 360px: two cards, no horizontal overflow,
  dialog opens with preserved edition grid and closes with Escape. Preview used blocked production
  writes and simulated admin state; realtime errors are expected from that read-only harness.
- Remote service/mounts/health rediscovered. Complete installed hook directory copied privately for
  comparison. Production is behind local committed hooks in several unrelated areas; deploy only
  required feature hooks/dependencies after reviewing drift, with root-owned backup and rollback.
- Next: finish proposal feature, run integrated gates/browser checks, back up/deploy scoped hooks,
  release frontend with the canonical local release workflow, verify live Pages, then link the Calls
  guide to records with `scripts/migrate-open-calls.ts --apply --link-page` and verify rendering.
