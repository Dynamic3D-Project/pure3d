# Performance code-pattern review — 26 September 2026

Read-only follow-up to [the production measurements](performance-review-2026-09-26.md).
No application code, production data, permissions or infrastructure were changed.

“Observed” below means reproduced in the managed, unauthenticated headless browser.
“Source-confirmed” means the call path exists, not that its production cost has been measured.
Priorities distinguish public browsing from authenticated/editorial and operator-only work.

## Highest-priority patterns

### 1. Speculative downloads have a file-count limit, but no byte budget

**Observed; public catalogue; high impact.**

`src/lib/components/cards/EditionCard.svelte:37–93` runs on mouse entry over either the image
or title links (`:190`, `:199`). It immediately fetches the scene and adds prefetch links for
up to three GLB/GLTF files, including derivative assets. There is no application-level hover
intent delay, model byte budget, cancellation on mouse leave, or cross-card request registry.
The `hasPrefetched` guard belongs to the component instance, not the application session.

Production reproduction, hovering the Church card without clicking:

- Added prefetch links for `scene.svx.json` and `olv_cut.glb`.
- Attempted the **121,548,408-byte GLB** request with `Sec-Purpose: prefetch`.
- The test intercepted and aborted the GLB before downloading its body.
- Requested the scene as both a prefetch and a normal fetch.
- Also triggered SvelteKit's separate edition-route metadata preload.
- Both manually appended prefetch links remained after SPA navigation to Collections.

This can spend bandwidth on editions the visitor never opens and compete with useful work.
“Only three files” is not a safe budget when one file is 122 MB. Prefer removing speculative
GLB downloads; retain only deliberate, bounded metadata/scene preloading if it proves useful.
Any remaining manually inserted resource hints need ownership and cleanup.

**Cache nuance:** a separate 4.4 MB probe showed the link prefetch used `no-cors` without an
Origin header; the subsequent normal fetch used CORS with an Origin header. The asset varies
on Origin. The subsequent fetch made a network validation round trip of approximately 247 ms
but transferred **zero additional body bytes**; another fetch was cached in approximately
3 ms. This is not proof that every prefetch downloads the body twice. It does show that the
current hint is not guaranteed to turn the later fetch into an immediate cache hit.

### 2. The same global-collection rule pattern exists on private review data

**Source-confirmed pattern; authenticated workflows; high-risk pending query-plan tests.**

The main edition rule's uncorrelated joins were already reproduced and isolated. The same
`@collection.<table>:alias` structure occurs in:

- `pocketbase/pb_schema/collections.json:852–853`: `editionReviews` list/view rules reference
  review assignments, edition memberships and collection memberships.
- `collections.json:1063–1064`: `reviewFeedback` list/view rules reference those three tables.
- `collections.json:1066`: feedback update authorization references two membership aliases.

These are strong candidates for the same intermediate-row multiplication, but their generated
SQL and production cardinalities were not separately measured in this pass. Audit them as a
family, rather than fixing only the public catalogue. Use correlated relation paths and test
reviewer identity, stage, round, release state and privacy before applying any rewrite.

### 3. Authorization queries are repeated for every returned edition

**Source-confirmed; authenticated catalogue and edition consumers.**

`pocketbase/pb_hooks/orcid.pb.js:151–163` calls `roles()` on every enriched edition.
`orcid-service.cjs:77–120` performs separate lookups for collection owner/editor, edition
author/collaborator and review assignment. Owner/editor repeat the same membership query;
author/collaborator do likewise.

For an authenticated actor, this is up to **five secondary queries per edition**, or 275 for
55 editions. The role object evaluates those properties even if its `admin` property is true.
Anonymous membership queries short-circuit, so this is separate from the diagnosed anonymous
catalogue query. Request-local batching/caching can remove repeated lookups while preserving
private-field hiding. Do not introduce a shared cross-user authorization cache.

## Additional public-page patterns

### 4. Global components pull editing dependencies into reader pages

**Source-confirmed and supported by the earlier production network capture.**

- `src/lib/components/ui/FeedbackPill.svelte:7` statically imports `RichTextEditor`.
- `Header.svelte:7–24` statically imports administrator menu-editing and login/search UI.
- `Login/LoginButton.svelte:6–7` statically imports the form and artwork.

The shared production editor-related chunk was approximately 139 KB compressed / 438 KB
decoded, plus editor CSS. The feedback editor itself is conditionally instantiated, so the
finding is unnecessary download/parse cost, not that a live Tiptap editor runs on every page.
Use dynamic imports at the point an optional interface is opened or authorized.

### 5. Debouncing protects input frequency, but not obsolete requests

**Source-confirmed; public search; workload impact needs a bounded typing trace.**

`src/lib/database/client.ts:19` disables PocketBase automatic cancellation globally.
`Search.svelte:89–116` launches three requests per search; `:161–176` debounces changes by
250 ms. Its request counter prevents stale results replacing current results, but does not
cancel the old requests. Typing with pauses longer than the debounce can leave several query
sets in flight. Closing the results panel also does not cancel them.

Use explicit component-owned cancellation and appropriate request deduplication. Do not
blindly enable global SDK cancellation: independent components legitimately query the same
collection in parallel. Client abort also does not guarantee already-running SQL stops.

### 6. Secondary information is placed on the primary rendering path

**Source-confirmed and measured in the earlier investigation.**

- Collection counts gate all collection cards (`src/lib/stores/data.store.ts:214–236`).
- Version-history sibling records gate the edition route
  (`src/routes/editions/[slug]/+page.ts:129–159`).
- Global menus first fetch configuration, then directory records
  (`src/lib/stores/navigation.ts:79–85`). Requested directory types are already filtered,
  so this is not an unconditional fetch of every collection on every navigation.
- Each embedded edition grid independently fetches full records on mount
  (`src/lib/components/content/ContentEditionGrid.svelte:15–39`). Each grid is bounded to
  24 references, but overlapping grids do not share results. The renderer mounts grids even
  inside initially closed expandable content (`ContentRenderer.svelte:16–25`).

Fix the bad SQL first. Then separate optional information from initial content and reuse
already-fetched public records where semantics and permissions allow it. Do not remove
necessary loading dependencies indiscriminately.

## Authenticated, editorial and operator paths

### 7. Async subscription setup has no stale-owner guard

**Source-confirmed race risk; not reproduced with an authenticated production account.**

`src/lib/database/stores/notifications.svelte.ts:13–54` awaits initial data before replacing
the old subscription, then installs the unsubscribe handle in an unguarded promise callback.
`unsubscribeAll()` at `:57–61` cannot cancel a still-pending setup. Authentication changes
invoke this setup repeatedly (`auth.svelte.ts:37–47`).

A sign-out/account change or overlapping refresh can finish an older setup after teardown,
restoring a subscription or stale data. Make setup idempotent per recipient and guard every
async continuation with a generation/owner check; immediately dispose subscriptions that
finish after their owner has gone. This is both lifecycle correctness and a potential source
of retained realtime work, not a measured memory-leak claim.

### 8. The public review endpoint computes private progress it discards

**Source-confirmed; only editions whose public review UI requests it.**

`pocketbase/pb_hooks/publication-service.cjs:168–199` always loads current assignments and
submitted reviews, and matches them in memory, even when `publicOnly=true` omits all those
progress fields. It then separately loads the released reviews actually returned. Named
attribution adds a user lookup per review (`:144–166`). Branch the public path before the
unused queries; batch reviewer names if volume warrants it, retaining attribution/privacy rules.

### 9. User writes perform external work or recipient fan-out in the request

**Source-confirmed; SMTP/external-call latency was not measured.**

- `feedback-email.pb.js:9–24,45–63` loads recipients and sends mail serially inside the
  update-request hook. A slow SMTP server occupies that request handler. Move delivery to a
  bounded outbox/worker without weakening submission durability.
- `activity-service.cjs:53–102` discovers recipients, checks each user and writes one
  notification per recipient in the workflow transaction. Context guards prevent recursion;
  the concern is transaction duration proportional to recipient count, not an infinite loop.
- `orcid-service.cjs:681–693` performs the person and employment HTTP reads sequentially during
  profile refresh. Keep optional enrichment outside the critical sign-in experience where
  possible. Authentication/JWKS caching requires separate security review, not a blanket
  removal of cache safeguards.

### 10. “Get everything” endpoints scale with the complete dataset

**Source-confirmed growth/availability risks; not identified as the public image delay.**

- Admin storage inventory calls `filesystem.list('')`, then materializes one full JSON response
  (`storage-dashboard.pb.js:1–24`). Paginate by prefix/key. The relevant scale is object count,
  not the total number of model bytes stored.
- Public `/api/pure3d/orcid/ready` sends `no-store` and scans every collection/edition plus
  linked credit identities (`orcid.pb.js:366–375`, `orcid-readiness.cjs:116–139`). It is intended
  as a deployment audit and has no frontend call site. Separate cheap health/readiness from
  operator-only full-data audits rather than letting repeated probes run full scans.
- The opt-in email worker polls the oldest 50 eligible unsent notifications every five minutes
  (`workflow-email.pb.js:1–43`). Current notification indexes do not specifically cover the
  pending-queue predicate (`collections.json:996–999`). Use a query plan and realistic queue
  history before adding an index; this is not a demonstrated current bottleneck.

## Patterns examined that do not justify alarm

- In a two-second idle sample on Hannover, Voyager scheduled 120 RAF callbacks while visible
  and another 120 while its canvas was fully offscreen. However, instrumentation recorded
  **zero WebGL draw calls** in both idle samples and only approximately **7 ms total callback
  execution per sample**. Continuous ticking exists, but this is not evidence of expensive
  offscreen GPU rendering in this scene. Animating scenes were not profiled.
- After SPA navigation away, Voyager RAF callbacks fell to **zero**. The existing pulse stop
  at `VoyagerViewer.svelte:463–475` works in this test; do not report a demonstrated route leak.
- `LoginArtwork` is only mounted while the login modal is open (`LoginButton.svelte:176`),
  respects reduced motion/document visibility and cleans up RAF/observers/listeners. Its
  4,525-point draw/sort loop is not running behind every anonymous page.
- `ViewerResources` already aborts registered event listeners and clears owned timers.
  Prepared-scene loading already aborts on cleanup (`EditionView.svelte:475–507`).
- Catalogue filtering over 55 records and ordinary small JSON transformations are not credible
  explanations for the measured multi-second delay. Avoid speculative memoization/virtualization
  work until measurements justify it.
- The global `preserveDrawingBuffer` patch (`viewer-resources.ts:107–126`) remains a GPU/memory
  profiling candidate, but removing it may break capture. No performance gain was measured here.

## Recommended order

1. Fix and regression-test the edition permission joins, then audit the two review rule families.
2. Stop speculative large-model downloads on hover.
3. Remove authenticated role-query duplication.
4. Apply the measured image-delivery fixes from the production report and defer optional editor code.
5. Add request/subscription ownership and cancellation where obsolete work survives.
6. Optimize administrative scans, write fan-out and background indexes when their traffic warrants it.

This pass used source inspection plus bounded public hover, cache-validation and viewer lifecycle
experiments. It did not send feedback, sign in, modify records, send email, enumerate production
storage or run full-data readiness audits. No authenticated production performance is claimed.
