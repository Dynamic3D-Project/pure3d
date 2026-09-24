# Ponytail project pass — 24 September 2026

## Checkpoint and scope

Workflow checkpoint: `5edb570` (`feat(workflow): complete review and publication`).
The cleanup is a separate working-tree change, with no push or deployment.

The pass inventoried source-file sizes, ran project-wide ESLint and the full Bun
test suite, and inspected workflow permissions, navigation, review helpers,
schema setup and audit wiring. It is not a line-by-line audit of every file or a
claim that all repository technical debt has been removed.

## Changes made

- **One workflow presentation definition:** timeline stages and link anchors now
  come from `src/lib/workflow/presentation.ts`, used by the workflow, My Work,
  profile and admin views. New Final Review/publication states no longer fall
  through duplicated old link switches.
- **Permissions aligned:** frontend transition decisions match backend role
  decisions for every status pair and role combination. Publication and reviewer
  assignment are editorial actions; ordinary unpublish remains unavailable.
- **Old shortcuts removed:** removed the disabled resubmit handler/buttons.
  Aggregate reviewer votes only map proposal decisions; Alpha and Final rounds
  require their editorial release endpoints. Zero assignments cannot aggregate
  to an approval.
- **Review privacy and round correctness:** generic summaries do not assume that
  Final Review implies consent to name attribution. Public attribution continues
  to come from the backend endpoint. Admin filtering uses the current Final round
  as well as the current Alpha round.
- **Two coherent UI extractions:** `ProposalQuestionnaire.svelte` owns the proposal
  questions/audience controls; `ReviewWorkspace.svelte` owns the reviewer layout
  and expansion state. Submission, persistence and navigation remain with their
  existing owners rather than creating a new framework or global store.
- **Audit/schema inconsistency fixed:** the audit regression test now targets the
  current `content` collection. The canonical audit schema now permits `content`,
  matching CMS setup, while retaining the historical `documentation` value.
- **Schema setup made non-destructive:** extracted tested field merging into
  `scripts/schema-fields.ts`. Type changes or relation retargeting now stop with
  an explicit-migration error instead of dropping/recreating fields. Non-404
  collection lookup failures are no longer mistaken for missing collections.
  Redundant raw authentication response logging was removed.
- **Quality checks scoped correctly:** versioned upstream Voyager distributions
  are excluded from ESLint/Prettier. Application-owned bridge files remain in
  scope. Before this change, ESLint reported over 166,000 findings, overwhelmingly
  from minified third-party bundles. No application lint rules were disabled.

## Verification

- Full suite: **190 tests pass, zero failures**, including disposable PocketBase
  integration tests. The previously failing documentation-audit test and the
  stale direct-publication unit-test expectation are corrected.
- Permission parity covers all current status pairs across global, collection
  and edition roles.
- Added regression tests for timeline coverage, workflow anchors, review rounds,
  anonymous summaries, editorial-only verdict handling and safe schema merging.
- Browser: extracted proposal fields and audience selection save/reopen; reviewer
  draft survives expansion/collapse and reload; mobile and desktop layouts have
  no horizontal overflow. These use synthetic local accounts and records only.
- Final `bun run check`: zero errors/warnings. `bun run build`: passed. ESLint on
  all changed code and `git diff --check`: passed. This pass does not retest
  production SMTP or real 3D rendering.

## Remaining work: deliberately not disguised as cleanup

The repository is **not globally lint-clean**. `bun run lint` stops at 72 existing
Prettier findings outside this cleanup. With vendor code excluded, ESLint
reports 352 application/tooling findings across 55 files, mainly explicit `any`,
old navigation links, unused declarations and unkeyed loops. These are recorded
rather than suppressed or bulk-rewritten during a workflow acceptance pass.

Largest remaining files and sensible boundaries for subsequent work:

| File                                                                              | Finding / next sensible boundary                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/design/+page.svelte` (~4,555 lines)                                   | Design sandbox, not the author workflow. Split demo sections only when those demos are maintained; avoid churn merely for a line-count target.                                                                   |
| `src/routes/editions/[slug]/+page.svelte` (~2,505 lines)                          | Public edition page mixes legacy/demo/experimental presentation with metadata, reviews and reader views. Extract typed edition-detail panels first; preserve the existing experimental-viewer gate.              |
| `src/routes/editions/[slug]/workflow/+page.svelte` (~1,900 lines after this pass) | Still combines proposal/edition draft state, uploads and navigation safeguards. Next extraction should move a whole draft lifecycle with its race/navigation tests, not distribute that state across many props. |
| `src/lib/components/voyager/VoyagerViewer.svelte` (~1,829 lines)                  | Runtime listeners, loading, tokens and controls are tightly coupled. Any split needs real scene fixtures and listener/token lifecycle regression tests. Not a safe cosmetic rewrite.                             |
| `src/routes/+page.svelte`, `Header.svelte`, admin workflow (~1,000–1,350 lines)   | Candidate presentation-section boundaries; current functionality should be captured before further extraction.                                                                                                   |
| Legacy setup/import scripts                                                       | Several older entry points remain. Establish which are still operational before deleting or consolidating them. Automatic relation retargeting in the main setup path is now blocked.                            |

The goal of this pass is a safer, less contradictory base for acceptance testing,
not to replace the application architecture just before partners review it.

## Follow-up cleanup batches

The follow-up started with a clean working tree: the initial cleanup was already
committed as `e600967`, separately from workflow checkpoint `5edb570`. It was not
recommitted or amended. Fresh verification reproduced 190 passing tests using a
disposable PocketBase binary, zero Svelte diagnostics and a successful build.

- **Field identity preservation (`b870106`):** desired schema definitions carrying
  exported IDs can no longer replace an existing field's stored ID. Regression
  tests cover conflicting, empty and undefined IDs, new fields and input preservation.
- **Metadata presentation boundary (`6b2b827`):** `EditionMetadata.svelte` owns the
  publication, contributor, rights and technical-provenance markup and responsive
  styles behind a typed prop contract. The page retains viewer state, gates,
  normalized credits, clipboard state and review access. No draft, autosave,
  upload or navigation lifecycle was moved.
- **Protected document labels:** metadata strips query strings and fragments from
  scene-document labels, so protected-file tokens are not printed in the panel.
  The original scene URL and viewer authentication remain unchanged.

Follow-up verification:

- Full disposable-PocketBase suite: **194 passed, zero failures**; `bun run check`
  and `bun run build` passed. Focused Prettier checks and `git diff --check` passed.
- Headless Playwright checked the demo metadata panel at 1440×900, 1024×768 and
  390×844: all four sections present, no horizontal overflow, responsive columns
  retained and DOI-copy callback/feedback correct (clipboard stubbed).
- A mounted synthetic metadata fixture confirmed empty-field fallbacks, token-free
  display and an unchanged authenticated source URL. No real records were edited.
- The demo browser reported existing missing CMS collection responses and an initial
  favicon 404. This was not a fresh end-to-end authenticated workflow acceptance run.
- Global lint still fails on the pre-existing 72 formatting findings. Edition-page
  ESLint findings decreased from 50 to 38 across the page and extracted component;
  one existing unresolved alternate-version link finding moved with the panel.
  No lint rules were disabled. The new schema and label helpers/tests pass ESLint.

The remaining lifecycle extractions, viewer-runtime work and legacy-script inventory
above remain deferred, not claimed complete. No delegation, push or deployment.
