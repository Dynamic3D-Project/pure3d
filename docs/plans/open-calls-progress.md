# Open calls rollout — completed 21 October 2026

- Issue: [#100](https://github.com/Dynamic3D-Project/pure3d/issues/100), milestone **2.0 Fixes**,
  related to #98.
- Release: [v0.20.0](https://github.com/Dynamic3D-Project/pure3d/releases/tag/v0.20.0).
  Verified source: `b60cdb1a40165332d2772316b5f63769e4b074eb`; release commit: `85ca5bc`.
  [Pages deployment](https://github.com/Dynamic3D-Project/pure3d/actions/runs/39618308033) succeeded;
  the live `version.json` matches the release and source commit.
- Production has two migrated `open_calls` records and optional `editions.proposalOpenCall`.
  Existing edition fields, permissions and 115 records were preserved during schema migration.
- Four feature hooks deployed: `cms-service.cjs`, `cms.pb.js`, `proposal-service.cjs` and
  `orcid-service.cjs`. Installed checksums, local/public health, readiness, production superuser
  authentication and affected read-only APIs were verified.
- The first hook attempt accidentally included a concurrent uncommitted Sandbox dependency.
  Functional checks detected it; all four hooks were restored immediately. Deployment was then
  repeated successfully using only the immutable, tested source clone. Concurrent Sandbox and
  Resources work remains untouched and was not deployed.
- Complete root-owned hook backup retained at
  `/var/backups/pure3d-hooks-open-calls-verified-20261021T143357Z`.
  Database backups include `proposal-open-call-before-1792589949191.zip` and
  `open-calls-before-1792593548510.zip`; private downloaded copies passed ZIP and SQLite integrity.
- The production Calls guide now stores one reusable component referencing both records, rather
  than inline call bodies. Live browser verification found two resolved calls, no old inline
  expandables, preserved introduction and edition grids, and no overflow at mobile widths.
- Homepage cards/dialogs, admin editing and CMS insertion/save/reopen are implemented. Call writes
  use version checks; referenced calls cannot be deleted. Recursive call embedding is rejected.
- Proposals default to General submission. New selections and first submissions require a current
  published call; previously submitted proposals preserve immutable call metadata after closure.
- Checks: default suite **40 passed, 30 opt-in skips**; production-matched PocketBase 0.40.3 workflow
  selection **6 passed / 120 assertions**; CMS lifecycle **1 passed / 19 assertions**. Release Svelte
  check passed with **0 errors / 6 existing warnings**; scoped lint/format and production build passed.
- Actual browser journeys used disposable local accounts and data: CMS insertion/save/reopen,
  live referenced edits, author selection/autosave/reopen/submission, and assigned reviewer seeing
  the original call metadata after unpublication. Desktop/tablet/mobile geometry checks passed.
  Production proposal content was not created merely to test deployment.
- Clean-clone release prerequisites: compile Paraglide from `locale/project.inlang` and inject the
  public production backend/asset URLs before `make release`. No private `.env` was copied.
