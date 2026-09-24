# Ponytail project pass — 24 September 2026

## Checkpoint and scope

Workflow checkpoint: `5edb570` (`feat(workflow): complete review and publication`).
The cleanup is committed separately from that checkpoint, with no push or deployment.

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

## Initial follow-up inventory (now resolved below)

At the initial checkpoint, the repository was **not globally lint-clean**. `bun run lint` stopped at 72 existing
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

Those lifecycle and inventory tasks were deferred at this intermediate checkpoint.
The completion batches below supersede that status.

## Completion batches

- **Legacy scripts:** removed superseded destructive setup/import prototypes and
  retired-schema inspection scripts after checking callers. The supported chain
  and retirement reasons are in [the script inventory](pocketbase/scripts.md).
  Account recovery no longer recommends deleting the database.
- **Repository lint:** normalized formatting, removed unused starter components,
  replaced ambient `any` shims with typed icons and Bun test types, typed maintained
  scripts and runtime bridges, resolved navigation paths and keyed UI loops.
  Repository-wide Prettier and ESLint now pass without disabling application rules.
- **Edition presentation:** `EditionView.svelte` is the typed shared public/demo
  view; routes no longer import another route component. Metadata remains a separate
  panel. The experimental viewer gate stays unchanged. Blog, collection, review and
  help HTML use the existing sanitizer. Record-provided links use a tested URL
  allowlist and deployment base handling; demo downloads retain plain-text data URLs.
- **Voyager lifecycle:** extracted typed runtime contracts, shared fetch dispatch,
  script loading, console/canvas hook ownership and disposable listeners/timers.
  Overlapping viewers can dispose out of order without restoring stale hooks.
  Protected companion URLs retain their tokens and Request options. Tests cover
  malformed filenames, directory boundaries, stream failures, pending downloads,
  concurrent script requests and teardown. No upstream runtime bundles were edited.
- **Draft lifecycle:** proposal/edition persistence now uses the existing tested
  `DraftAutosave` controller instead of a second queue/timer implementation.
  Upload/submission locks preserve dirty state; late disposed responses cannot
  update another workspace. The route keys `EditionWorkflowPage` by edition and
  account, while persistence, upload controls and navigation warnings stay together.
  Tests cover overlapping edits, retries, reverts, submission locking and navigation
  checks before the reactive effect runs.
- **Size-only candidates closed without churn:** the design sandbox, homepage,
  header and admin presentation were candidate boundaries, not identified defects.
  Their applicable lint findings were fixed. No arbitrary line-count target or
  new component framework was introduced. The shared edition/workflow components
  remain substantial because their UI state belongs together.

## Final verification and limits

- `PB_TEST_BINARY=/private/var/folders/78/t7tp8f_557d8qdc94shsqp0w0000gn/T/opencode/proposal-pocketbase/pocketbase bun --no-env-file test`:
  **212 passed, zero failures, zero skipped**, including disposable PocketBase tests.
- `bun run check`: zero errors/warnings. `bun run lint`, `bun run build` and
  `git diff --check`: passed.
- Headless browser checks covered collections, editions, a synthetic collection,
  blog and feedback at 1440×900, 1024×768 and 390×844, without horizontal overflow.
  Synthetic hostile collection HTML did not execute.
- Demo metadata, description, versions and printables passed the same width matrix;
  four plain-text downloads remained available and the anonymous experimental gate
  remained closed.
- A real local Voyager scene exposed five annotations, fourteen articles and a
  rendered canvas. UI remount/navigation restored the original fetch, console and
  canvas methods and removed the viewer. A first browser probe timed out because
  this runtime has no `getModels` method; subsequent checks used its actual APIs.
- Synthetic intercepted workflow records verified autosave, save/reopen, switching
  between two editions without cross-writing, responsive overflow and cancellation
  of dirty navigation. Confirmation was stubbed for deterministic verification.
  No real records were changed by these browser checks.
- Browser limitations remain explicit: local missing CMS/favicon responses and an
  upstream Voyager 0.59.0 late `graph` callback error during rapid model teardown
  were observed. Application-owned hooks were restored despite that vendor error.
  This is not a fresh production SMTP, external identity-provider or full authenticated
  publication acceptance test; backend integration tests use disposable services.

The scoped cleanup tasks are complete. This is not a claim of zero technical debt
or a line-by-line audit. No delegation, push or deployment was performed.
