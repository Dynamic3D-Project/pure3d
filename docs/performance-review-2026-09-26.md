# Production performance review — 26 September 2026

> Follow-up: the catalogue query problem has now been reproduced and isolated. See
> [confirmed permission-rule bottleneck](#follow-up-confirmed-permission-rule-bottleneck).
> The initial hook/query-plan hypotheses below are retained as the investigation history,
> not as the final diagnosis.

## Scope and method

- Frontend: https://dynamic3d-project.github.io/pure3d/
- API/assets: https://main.57-129-98-223.sslip.io
- Live `version.json`: `v2.0.0-beta.5`, source `f3de4775a2079e0f076b271ee9256fae0b481462`.
- Local source reviewed: `e5dfd62`. The relevant frontend matches the deployed source;
  production backend source/configuration was not independently verified.
- Anonymous, read-only GET/HEAD/range requests; sequential curl samples and headless Chromium
  153 through configured Playwright. A fresh isolated browser context was created and reused
  for controlled first/repeat asset tests. No production changes or load/stress tests.
- Measurements are from this test environment, without network/CPU throttling. They are not
  global percentiles or a mobile benchmark. No OVH CPU, disk, database trace, or origin logs
  were available. HTTP response time includes network, proxy, backend and serialization;
  it must not be presented as pure database execution time.
- Cross-origin Resource Timing hides byte counts/TTFB without `Timing-Allow-Origin`.
  Request timings, CDP, curl and response headers supplied those measurements instead.
- LCP measures page text/images, **not readiness of the WebGL model**. Voyager's `model-load`
  event can also precede expensive rendering work, and fires separately for multiple models.

## Main conclusion

There are several separate bottlenecks, not evidence that all of OVH or GitHub Pages is slow:

1. Catalogue API requests do excessive record processing and gate visible page content.
2. Some editions load much more geometry/texture data than their apparent model size suggests.
3. The asset origin uses HTTP/1.1, causing substantial request queueing for multi-model scenes.
4. Large model initialization blocks the browser after the bytes arrive.
5. Asset caching is partly effective but lacks an explicit policy; large repeat transfers need
   further investigation in persistent browsers, not an assumption that all caching is broken.

## Measurements

### HTTP/API probes

Three sequential samples per API shape, no concurrent model downloads during this batch.
MB below means decimal MB.

| Probe                                                                  | Measured time                         | Response size / interpretation                       |
| ---------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| GitHub Pages homepage HTML                                             | 0.030–0.131 s total                   | 2,445 bytes; shell delivery is fast                  |
| PocketBase health                                                      | 0.062–0.068 s total                   | Basic connectivity is fast; not a DB benchmark       |
| Published editions, `perPage=500`, full records + collection expansion | 1.32–1.55 s TTFB; 1.40–1.63 s total   | 55 records, 279,240 bytes                            |
| Same list, only `id,collection`                                        | 1.27–1.44 s TTFB                      | Only 3,145 bytes; payload size is not the main delay |
| Same ID list, `skipTotal=1`                                            | 1.29–1.36 s TTFB                      | Skipping the count alone does not fix the full list  |
| Eight editions, `id,title,thumbnail`, with total                       | 0.459–0.475 s TTFB                    | 1,162 bytes                                          |
| Same eight editions, `skipTotal=1`                                     | 0.144–0.159 s TTFB                    | Roughly 0.3 s saved by omitting the count            |
| Individual edition in browser                                          | Approximately 0.03–0.10 s per request | Much faster than the catalogue                       |
| Individual 4.40 MB `illium.glb`                                        | 0.717–0.893 s total                   | 4.9–6.1 MB/s, including initial latency              |
| Individual 19.72 MB helmet lamp GLB                                    | 1.86–2.06 s total                     | Approximately 9.6–10.6 MB/s                          |

The actual home query also expands collection data and took 0.65–0.68 s in browser samples.
The eight-record field-projected probe above is a controlled comparison, not that exact query.

### Page display

These catalogue samples had no stored catalogue data, but some application JS was already
cached from edition testing. They are cold **data** visits, not completely cold browser visits.

| Page                          | Observation                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Home                          | First contentful paint 0.396 s; edition card links appeared at 1.067 s                |
| Editions                      | Edition request 1.969 s; card links appeared at 2.190 s; final observed LCP 2.372 s   |
| Collections                   | Collections request 0.084 s, but edition-count input request 1.876 s; LCP 2.128 s     |
| Let There Be Light collection | Collection request 0.050 s, then edition request 0.156 s; LCP 0.724 s                 |
| Resources                     | Content-list request 0.122 s; first contentful paint 0.488 s; LCP 0.780 s             |
| Editions, repeat visit        | Cached cards appeared at 0.080 s; no editions API request; final observed LCP 0.536 s |

The localStorage catalogue cache demonstrably works. It does not fix first visits, and
authenticated behavior was not browser-tested.

### Models and browser work

| Edition/model            | Payload                                | Observation                                                                                                                          |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Attachable Helmet Lamp   | 19.72 MB                               | Fresh-context GLB transfer 1.804 s, starting 1.063 s after navigation; a subsequent 568 ms main-thread task ended around 3.91 s      |
| Helmet Lamp, repeat      | 19.72 MB retransferred                 | GLB transfer 2.093 s; `model-load` at 2.947 s, followed by a 508 ms main-thread task                                                 |
| Hannover Expo            | 12.53 MB                               | First model load with warm app assets at 1.748 s; repeat at 1.733 s; full GLB transfer on both; no observed >50 ms main-thread tasks |
| Church of Our Lady       | 121.55 MB                              | GLB transfer 10.316 s; `model-load` at 12.257 s; then a 2.009 s main-thread task                                                     |
| Muffin's Journey         | 14 unique GLBs, 67.14 MB total         | Most assets cold; one 4.40 MB asset already cached. Last transfer finished around 6.82 s; last observed model event at 6.91 s        |
| Muffin's Journey, repeat | Mixture of cached and refetched models | Last observed model event at 3.60 s; a 576 ms main-thread task plus several smaller stalls                                           |

Muffin starts all 14 GLB URLs at approximately the same time. Actual request-start delays
reached **3.89 s** before a queued model began sending its HTTP request. Several individual
4–8 MB models therefore take multiple seconds despite an isolated 4.4 MB download taking
less than one second in curl. Shared bandwidth, HTTP/1.1 connection limits and browser work
all contribute; the request queue is not database time.

GLB JSON headers and embedded image headers were inspected using bounded range requests:

| Model             | Texture evidence                                          | Geometry                             |
| ----------------- | --------------------------------------------------------- | ------------------------------------ |
| Helmet lamp       | 13.77 MB of images; 8192×8192 JPEG and 6645×2800 PNG      | 109,400 positions across four meshes |
| Hannover          | No embedded images                                        | 438,989 positions                    |
| `maarten_low.glb` | 110.10 MB total, including 85.55 MB of two 4096×4096 PNGs | 673,273 positions                    |
| Church            | 82.78 MB JPEG at **16384×16384**                          | 813,807 positions                    |

None of these four files declares glTF compression extensions. The Church texture alone
would occupy approximately **1 GiB** if decoded to RGBA8, before mipmaps or additional copies.
That is an indicative memory calculation, not a measured GPU allocation. A “low” filename
does not establish a lightweight web derivative. Maarten's model was inspected with range
requests, not loaded end-to-end in the viewer.

## Caching and delivery: what is and is not broken

- GitHub Pages JS is gzip-compressed and sends `Cache-Control: max-age=600`.
- Sampled `/assets/...` GLBs, scene JSON and legacy thumbnails have `ETag`, `Last-Modified`
  and `Accept-Ranges`, but no `Cache-Control` or `Expires`.
- Conditional GLB requests using either `If-None-Match` or `If-Modified-Since` correctly
  returned **304 with zero body bytes**. Scene JSON conditional requests also returned 304.
  Validators are not broken.
- An isolated browser fetched a 4.40 MB GLB in 1.152 s, then read it from cache in 11 ms.
  Scene JSON, JS and many Muffin GLBs were also cached. Caching is not globally disabled.
- The 12.53 and 19.72 MB GLBs repeatedly transferred in full. Some smaller Muffin models
  were later refetched too. Cache capacity/eviction or isolated-context storage behavior
  remain possible explanations. Missing freshness headers alone do not prove causation.
- No explicit `no-store`/`no-cache` behavior was found in the viewer fetch path. The progress
  wrapper passes fetch options unchanged (`viewer-fetch.ts:85–125`); runtime instrumentation
  likewise observed no explicit cache mode on the GLB fetch.
- The asset/API origin negotiated **HTTP/1.1**, including when curl offered HTTP/2.
- A JSON API response remained uncompressed when gzip/Brotli were offered.
- No `Timing-Allow-Origin` or `Server-Timing` was observed on sampled asset/API responses.

Use explicit browser/CDN policies, but do not apply a one-year immutable policy to existing
mutable names such as `scene.svx.json`. Use content/version-specific URLs under the existing
`project/<collection>/<edition>/...` hierarchy for immutable derivatives; use revalidation or
short, intentional lifetimes for mutable manifests. Never shared-cache authenticated/private
responses. A CDN can improve distribution and origin load, but cannot remove geometry/texture
decode and rendering costs, nor guarantee browsers retain large files.

## Source findings and recommended changes

### 1. Remove the catalogue bottleneck from initial rendering

- `src/lib/stores/data.store.ts:120–126` requests up to 500 full editions with expansion.
  Use a small first page and explicit card/search fields; retain correct filtering/pagination.
- `data.store.ts:214–236` blocks collections on a second all-edition request just to calculate
  counts. Render collections independently and obtain counts through aggregation or a small
  separately loaded public summary. Preserve visibility rules in the aggregation.
- `data.store.ts:69–110` requests totals with home cards. Separate totals from the critical
  card request if exact statistics need not block it. The probe demonstrates the count saving.
- `src/routes/editions/[slug]/+page.ts:129–159` blocks the edition route on full sibling records.
  Project version-history fields, omit unused totals, and load secondary history independently.
- `src/routes/collections/[slug]/+page.ts:38–79` requests full editions with redundant collection
  expansion after fetching that same collection. Reduce the response and omit unused totals.

### 2. Profile PocketBase before buying a bigger server

`pocketbase/pb_hooks/orcid.pb.js:151–163` runs role checks and private-field hiding for every
edition returned. Field projection does not avoid this enrichment path. Its repeated JS/module
work is a candidate for the anonymous record-count scaling, **not a proven measured cause**.
The relationship-heavy access rule is another candidate (`pocketbase/pb_schema/collections.json:636`).

`orcid-service.cjs:77–120` contains a concrete authenticated N+1 pattern: up to five membership/
review queries per edition, potentially 275 for 55 records. Anonymous requests short-circuit
those membership queries, so that N+1 must not be blamed for the anonymous measurements.

Next profiling should separate count SQL, list/access-rule SQL, enrichment and serialization;
capture query plans and server CPU/disk behavior. Then simplify anonymous enrichment, batch
authenticated membership checks and add only indexes justified by query plans. Preserve all
private-field hiding and permission checks; test anonymous, author, reviewer and administrator
responses before deploying any optimization.

### 3. Produce web derivatives and prioritize scene assets

Keep preservation masters unchanged. Produce independently versioned web derivatives with
smaller textures and appropriate geometry simplification/compression, checking Voyager support
and scholarly visual accuracy. Test KTX2/Basis, Draco or meshopt support before adopting them.
The Church's 16K texture and Maarten's large PNG payload are immediate optimization candidates.

For multi-model scenes, inspect which models are actually needed for the initial camera/tour
step. Load a lightweight overview first, defer optional detail, and avoid auto-loading every
high-detail object where the scene allows it. HTTP/2 at the origin and a public asset CDN are
worth testing alongside this, not substitutes for a smaller total scene payload.

### 4. Remove unnecessary public-page JavaScript

`src/lib/components/ui/FeedbackPill.svelte:7` statically imports the rich-text editor from a
globally mounted component. Production loads a 437,605-byte decoded shared chunk containing
Tiptap/ProseMirror (approximately 139 KB transferred compressed), plus editor CSS, on public
pages before anyone opens feedback. Lazy-load the editor when its dialog opens. Also defer
administrator menu editing and modal-only login artwork (`Header.svelte:7–24`, `LoginButton.svelte:5–8`).
This is a useful cold-page/mobile improvement, not the cause of 100 MB model downloads.

### 5. Make loading indicators reflect actual readiness

`VoyagerViewer.svelte:343–348` schedules listener/setup work 500 ms after script readiness.
The custom element can already start loading before this callback; it is **not valid to claim
this necessarily adds 500 ms to every model download**.

At `:365–376` and `:424–453`, the first model event or a permissive annotations/models poll
marks loading complete and may remove progress interception. Multiple model events continue
afterward. In the Church run, the secondary scene-feature fetch appeared at 1.842 s while the
GLB was still downloading until 10.862 s. Report separate download/preparation states and do
not treat the first model event or an empty annotations array as whole-scene completion.
The current reported byte count may also be incomplete for queued multi-model requests.

`viewer-resources.ts:107–126` forces `preserveDrawingBuffer`. Profile whether capture can be
supported without retaining that cost continuously; do not remove screenshot functionality
without a tested replacement. Precise attribution of observed long tasks needs a CPU/GPU trace.

## Suggested order

1. Frontend: non-blocking collection counts/history, smaller first catalogue page, deferred editor.
2. Backend: phase timings and permission-preserving enrichment/query optimization.
3. Assets: optimize Church/Maarten textures and multi-model first-view loading; retain masters.
4. Infrastructure: explicit safe cache policies, HTTP/2, JSON compression, then CDN evaluation.
5. Repeat cold/warm tests in a persistent desktop profile and a representative mobile device;
   compare page-content timing, request queueing, transferred bytes and last-model/render readiness.

Do not upgrade OVH solely on this sample. Network latency and single-record reads were healthy;
the observed problems already have concrete application/payload causes. Capacity may still
matter under concurrency, but no capacity or cross-region test was performed.

## Reproduction examples

```sh
# Actual public catalogue request; repeat sequentially, not as a load test.
curl -sS --compressed -o /dev/null \
  -w 'status=%{http_code} ttfb=%{time_starttransfer} total=%{time_total} bytes=%{size_download}\n' \
  'https://main.57-129-98-223.sslip.io/api/collections/editions/records?perPage=500&filter=isPublished%3Dtrue&expand=collection'

# Compare this request with and without &skipTotal=1.
curl -sS -o /dev/null \
  -w 'ttfb=%{time_starttransfer} total=%{time_total}\n' \
  'https://main.57-129-98-223.sslip.io/api/collections/editions/records?perPage=8&filter=isPublished%3Dtrue&fields=id,title,thumbnail&skipTotal=1'

# Inspect cache policy/size without downloading a model.
curl -sSI 'https://main.57-129-98-223.sslip.io/assets/project/3/edition/1/olv_cut.glb'
```

The read-only source reviewer ran `bun test src/lib/components/voyager/viewer-fetch.test.ts`:
6 passed, 0 failed. No application code or production configuration was changed in this review.

## Follow-up: confirmed permission-rule bottleneck

The user correctly challenged pagination as an answer for just 55 records. Further tests
isolated a pathological query generated by the edition access rules, not an inherently slow
55-row database or a large response body.

### Isolation method

A consistent SQLite backup of the existing local database was placed in a private temporary
directory. Disposable PocketBase 0.39.5 containers ran with **network disabled**, no published
ports, no application startup/email hooks, and only a local diagnostic route plus the edition
enrichment hook when that was the variable under test. All changes were restricted to copies.
The original local database, project hooks and production were not modified.

The local copy contained 55 published editions (112 total), 271 edition memberships, 60
collection memberships and no review assignments. Timings below are local experiment results,
not a claim that the exact production server has already been patched or profiled internally.

### What the permission rule generates

The `@collection.editionUsers:m` and `@collection.reviewAssignments:r` references in
`pocketbase/pb_schema/collections.json:636–637` generate joins without `ON` predicates:

```sql
SELECT DISTINCT editions.*
FROM editions
LEFT JOIN editionUsers AS membership
LEFT JOIN reviewAssignments AS review
LEFT JOIN collections AS collection ON collection.id = editions.collection
LEFT JOIN collectionUsers AS collectionMembership
  ON collectionMembership.collection = collection.id
WHERE /* public OR authenticated permission checks */
  AND editions.isPublished = 1
LIMIT 500;
```

The record/user correlations occur inside the authenticated branch of the `WHERE` expression,
not in those first two joins. For a public edition the public branch is true regardless of the
joined membership rows. SQLite still generates the join combinations and removes duplicates
using a temporary B-tree over `editions.*`. Being anonymous does not remove the joins.

In this snapshot, 55 published editions produce **44,715 intermediate rows**. More review
assignments can multiply the work further. `EXPLAIN QUERY PLAN` confirms scans of the joined
membership/assignment aliases and `USE TEMP B-TREE FOR DISTINCT`.

The API `fields=id,collection` parameter does not prevent the generated SQL from selecting
`editions.*`, explaining why a tiny 3 KB API response can still require substantial work.
The existing published-edition index is used; adding that index again would not fix this.

### Controlled results

Three requests per scenario, with internal loopback HTTP timing so internet latency and the
Docker CLI invocation are excluded. All scenarios returned the same 55 published records.

| Access rule / hook                                                     | 55-ID list, no total | Eight-ID list with total |
| ---------------------------------------------------------------------- | -------------------- | ------------------------ |
| Original rule, enrichment removed                                      | 241–247 ms           | 77–84 ms                 |
| Original rule, normal enrichment retained                              | 263–295 ms           | 82–88 ms                 |
| Diagnostic public-only rule, no enrichment                             | 9–12 ms              | 1–7 ms                   |
| Diagnostic public-only rule, normal enrichment retained                | 21–41 ms             | 1–3 ms                   |
| Permission-preserving backrelation rewrite, no enrichment              | 13–16 ms             | 4–8 ms                   |
| Permission-preserving backrelation rewrite, normal enrichment retained | **28–42 ms**         | **5–10 ms**              |

The public-only rule was an **offline diagnostic**, not a proposed production replacement.
Removing enrichment barely changed the slow query; fixing the joins removed most of the delay.
The median endpoint comparison with enrichment retained was **284 ms → 30 ms**.

Independent SQLite execution of the exact generated anonymous query took **100–105 ms**,
versus **0.375–0.441 ms** for `SELECT * FROM editions WHERE isPublished = 1 LIMIT 500`.
The simpler ID-only query's median was 0.026 ms; counting published editions took 0.003 ms.
PocketBase dev SQL log prefixes showed 0 ms even for the expensive statement, so those prefixes
were not used as evidence of full result-consumption time.

### Tested rewrite

Use the actual reverse relations so PocketBase puts the edition correlation into each join:

```text
@collection.editionUsers:m.editionId ?= id &&
@collection.editionUsers:m.userId ?= @request.auth.id &&
@collection.editionUsers:m.role ?!= 'reviewer'

→

editionUsers_via_editionId.userId ?= @request.auth.id &&
editionUsers_via_editionId.role ?!= 'reviewer'
```

Similarly replace the `@collection.reviewAssignments:r` block with
`reviewAssignments_via_editionId`, removing only the redundant edition-ID comparison and
retaining the existing user, stage, round and status checks. Keep the surrounding public,
administrator, editorial-board and collection-membership conditions unchanged.

The generated SQL then contains:

```sql
LEFT JOIN editionUsers AS membership ON membership.editionId = editions.id
LEFT JOIN reviewAssignments AS review ON review.editionId = editions.id
```

An offline fixture compared old and rewritten rules for **nine actor types × fourteen edition
cases**, checking both list and individual-view access. It included anonymous users, admins,
board members, collection owners/editors, authors, collaborators, reviewers, unrelated users,
current/old review rounds, wrong stages, declined/completed reviews, and cross-row permission
traps. Every expected access result passed for both rules. The visible/hidden state of the
private proposal field was also identical on every accessible individual record.

This is the first fix to make, ahead of pagination or a server upgrade. It requires updating
the backend edition list/view rules safely, not just deploying frontend assets to GitHub Pages.
The rewrite has only been exercised in disposable copies; no production rule was changed.

## Follow-up: image loading and cache isolation

### Most of the initial image delay is before the download

A controlled browser experiment retained the current frontend and the same public image URLs.
Both passes had the edition API route registered for interception and the catalogue localStorage
cache cleared between passes. The baseline continued the real count-data request. The second
pass fulfilled only that request with its previously fetched, unchanged public JSON body.
All actual images were still requested from their normal production URLs; nothing was changed
on the server. This simulates eliminating the count-query wait, not a deployed fix benchmark.

| Collections-page measurement          | Real count-data response | Same data returned immediately |
| ------------------------------------- | ------------------------ | ------------------------------ |
| Edition count-data request duration   | 1,977 ms                 | 2 ms                           |
| Image requests start after navigation | **2,071 ms**             | **187 ms**                     |
| First image response completes        | 2,132 ms                 | 294 ms                         |
| First-row image responses complete    | 2,240–2,381 ms           | 294–392 ms                     |

This demonstrates that the slow database/API dependency postpones image discovery; changing
AVIF settings cannot remove that first two-second wait. The backend rule fix addresses its
cause. Counts should also not unnecessarily gate card rendering, as a resilience improvement.

### Remaining image delivery and display problems

- The image reviewer measured 15 collection images dispatched within 0.5 ms, all initially
  low priority, over six HTTP/1.1 connections. Completion spread was 151–451 ms. A separate
  main-session run measured 166–536 ms and explicitly observed approximately 165 ms and
  218 ms before request sending for two reused-connection image requests. HTTP/1.1 connection
  contention contributes, but these observations do not attribute every millisecond to queueing.
- The editions view initiated 25 image requests initially. A scroll triggered another 19.
  All cards are rendered, and native `loading="lazy"` preloads well beyond the viewport; it
  is not a strict concurrency limit. Prioritize visible cards and avoid loading large bursts
  of offscreen images. This is an image-scheduling issue, not justification for hiding the
  database defect behind catalogue pagination.
- `EditionCard.svelte:152–184` and `CollectionCard.svelte:67–96` hide their placeholder as soon
  as an image URL exists, **before image load completion**. A blank surface remains until the
  actual image arrives. Keep the placeholder until load/decode completion, including cached
  images and error handling. Do not add a long reveal animation that delays a ready image.
- The homepage chooses five hero editions randomly on each load (`src/routes/+page.svelte:10–17`).
  Three newly selected files on one repeat visit took 56, 180 and 357 ms, while cached images
  painted around 80–106 ms after navigation. Stabilizing selection for a session/cache interval
  avoids these unnecessary changes in requested files.
- Resource cards use the original CMS `coverUrl` (`src/routes/resources/+page.svelte:60–70`).
  Twelve initial resource images transferred approximately 906 KB. Sources measured 823–1600 px
  on their larger dimensions while the cards were roughly 379×237 CSS px in that run.
  Generate actual responsive/card derivatives, with suitable 1×/2× dimensions, rather than
  relying on format conversion alone.

### Thumbnail URLs do not currently guarantee resized AVIFs

Both of these returned HTTP 200, `Content-Type: image/avif`, **48,638 bytes** and **1398×786**:

```text
https://main.57-129-98-223.sslip.io/api/files/pbc_906786997/jo7z37n8ey4y5u6/mapping_the_past_9chazgq8jf_bgh4o4wyj8_wxlc40dazy.avif
https://main.57-129-98-223.sslip.io/api/files/pbc_906786997/jo7z37n8ey4y5u6/mapping_the_past_9chazgq8jf_bgh4o4wyj8_wxlc40dazy.avif?thumb=760x475
```

The `?thumb` parameter did not resize this file. The collection cover requested with
`?thumb=400x300` similarly remained 800×600. The exact backend reason (format decoder support,
configured thumbnail sizes, or another fallback) was not isolated; a frontend query-string
change alone is experimentally insufficient. Generate/verify real derivatives before changing
card URLs or claiming their dimensions.

### Caching and decoding conclusions

- Legacy `/assets/project/.../icon.avif` files have validators but no explicit freshness policy.
- PocketBase `/api/files/...` images **do** send
  `Cache-Control: max-age=2592000, stale-while-revalidate=86400`.
- Browser repeat tests explicitly reported cache hits and zero transfer for images. Do not
  describe the whole image cache as broken or apply one cache-policy fix indiscriminately.
- Use long-lived caching only for versioned/immutable asset URLs. Existing legacy image names
  can be overwritten, so they need deliberate invalidation/versioning or a bounded freshness
  policy, not an unconditional year-long immutable header.
- The image reviewer's measured `decode()` times (1–11 ms for cards, 4–15 ms for resource
  images) were collected **after the `load` event**. They show no large post-load decode tail,
  not the full decoding CPU cost. Full AVIF decode cost was not independently profiled.
  The controlled API experiment nevertheless establishes a much larger upstream delay.
- The 180 ms opacity transition in `src/app.css:203–209` applies on hover; computed initial
  opacity was 1. It does not explain the initial image wait.

Image protocol, dimensions, scheduling, placeholders and repeat caching were tested on the
homepage, editions, collections, collection detail, resources and resource detail. Temporary
browser instrumentation errors were corrected and the measurements rerun. All task-created
isolated browser contexts and diagnostic containers were closed after the experiments.
