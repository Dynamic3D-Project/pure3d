# Performance implementation and verification — 27 September 2026

**Rollout update:** after this initial verification, the user authorized production changes.
The seven reviewed production permission rules were backed up, applied and read back; the
55-ID request now measures a 258.3 ms median. See [server handoff](performance-server-handoff.md)
for the applied changes and remaining hook/proxy work. The sections below record the original
pre-deployment evidence, not the current rollout status.

Implemented the approved code work, excluding model/texture optimization. Production has not
been changed. Server access and rollout were explicitly deferred until this work was finished.

## Implemented

- Correlated edition, edition-review and review-feedback permission rules, preserving existing
  actor/stage/round restrictions and private-field protection.
- Request-local authorization batching through PocketBase's supported list hook and internal
  record data. Real PocketBase tests verify three membership queries per authenticated list,
  zero for admin/anonymous lists, isolation across users/requests, and fresh membership changes.
  No permissions are cached globally or attached to unsupported Go request-struct properties.
- Removed speculative model downloads and manually appended prefetch links from edition cards.
- Collection cards render independently of edition counts; version history no longer gates the
  main edition route. Catalogue queries use field projections including file-URL namespaces.
- Load-aware image placeholders, visible-card priorities, stable daily homepage selection,
  correct uploaded covers and manifest-driven responsive image sources.
- Non-destructive AVIF derivative tooling, with explicit source/output roots and measured
  image widths. The checked manifest remains empty until derivatives are actually published.
- Lazy feedback/editor and administrator menu imports; explicitly cancellable search scheduling
  and requests; recipient-owned notification subscription setup/teardown and retry handling.
- Viewer loading distinguishes transfer from preparation and uses Voyager's authoritative
  `CVViewer.outs.sceneLoaded` signal rather than counting model/quality events. Empty scenes
  are identified from the existing scene response and completed only once the runtime document
  is initialized. The scene is not fetched a second time for inspection.
- Durable, opt-in feedback email delivery with bounded retries, protected queue fields, schema
  migration and fresh-install provisioning. No SMTP delivery was enabled during testing.
- Cursor-paged storage responses and prefix selection; the UI labels totals and filtering as
  page-local and explicitly discloses the backing-scan limitation.
- Cheap public readiness, superuser-only credit audit, and removal of unused public-review
  queries. CI/local release checks now include all backend regression tests.

## Measured results

| Check                                                     | Result                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unchanged production API, 55 published edition IDs        | Three fresh samples: 1,670.8 / 1,645.5 / 1,430.0 ms; median 1,645.5 ms                                                                 |
| Live collection-page baseline                             | First image request at 2,623.7 ms in the browser sample                                                                                |
| Local production build using the unchanged production API | First image at 181.1 ms; count request started at 179.0 ms and finished at 1,470.2 ms                                                  |
| Church card hover in the new build                        | Zero GLB/GLTF requests; zero manually inserted prefetch links                                                                          |
| Reader-page editor loading                                | No rich-editor chunk before opening feedback; 437,611 decoded bytes loaded only after opening it                                       |
| Real multi-model local viewer                             | All 17 model/quality events occurred with progress visible; completion followed Voyager's runtime-ready signal; one scene JSON request |
| Empty-scene browser fixture                               | No stuck progress indicator and no model download                                                                                      |
| Search closed inside its debounce period                  | No request for the cancelled query; dropdown remained closed                                                                           |

The 181 ms measurement is a local-build browser sample, not a production deployment claim or
an apples-to-apples whole-page speed ratio: frontend serving origins differ. The decisive result
is that image requests now begin while the same slow production count query is still pending.
The previous isolated permission-rule experiment's approximately 284 → 30 ms improvement is
documented in [the investigation](performance-review-2026-09-26.md); no new production rule
timing is claimed here.

## Verification

- `PB_TEST_BINARY=<PocketBase 0.39.5 binary> bun --no-env-file test src scripts pocketbase`:
  **276 passed, 0 failed**, including disposable real-PocketBase permission/privacy and feedback
  queue/migration integration tests.
- `bun --no-env-file run check`: **0 errors, 0 warnings**.
- `bun --no-env-file run lint`: **passed**, including repository-wide Prettier and ESLint.
- Production build with `/pure3d` base and the public production API/asset URLs: **passed**.
- `git diff --check`: **passed**.
- Headless browser: home, collections, editions and resources at 1440×900, 1024×768 and
  390×844: no horizontal overflow, no broken visible images, no page exceptions in the matrix.
  Feedback opens its lazy editor and fits all three sizes; Escape closes it. Single-model,
  multi-model and synthetic empty-scene loading were checked against the local runtime.
- Desktop/mobile collection screenshots were inspected and shown in chat. No production
  feedback submissions, storage writes or email sends were made.

An additional run against the older PocketBase **0.26.3** binary failed the native OAuth
acceptance fixture (403 instead of 200). The local running PocketBase and the passing full
suite use **0.39.5**. Verify the actual production version and its OAuth support during server
inspection rather than treating the older binary as interchangeable. Intermediate lint/type
failures and a stale preview process after rebuilding were corrected before final verification.

## Still requires rollout or further infrastructure work

1. Back up production, review/apply the schema rules and queue fields, and install the hooks.
   Existing production credentials were verified by read-only schema/backup inspection only.
2. Enable/test HTTP/2 and explicit public asset freshness at the real TLS terminator. Nginx
   configuration is not managed by this checkout. See [performance rollout](performance-rollout.md).
3. Generate/upload public card derivatives, then populate the checked manifest. Until then,
   images deliberately use their existing originals. See [image derivatives](image-card-derivatives.md).
4. PocketBase's JavaScript `filesystem.list(prefix)` still materializes the matching prefix.
   Response pagination is implemented, but a truly bounded storage scan needs backend/storage
   API support. No claim is made that the full-bucket memory cost has been eliminated.
5. Verify SMTP delivery in an authorized environment; the worker is opt-in and delivery was
   intentionally not exercised. See [feedback email](feedback-email.md) for at-least-once behavior.
6. Authenticated administrator menu/storage browser workflows were not exercised end to end;
   permission/queue security was exercised against disposable PocketBase, not production accounts.

No commits, pushes, releases, production asset uploads or model/preservation-texture changes
were made. Retest production after rollout before attributing any production improvement to
these changes.
