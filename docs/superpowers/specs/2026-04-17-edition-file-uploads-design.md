# Edition File Uploads — Design Spec

## Overview

Add file upload support for edition cover images, 3D model files, and SVX scene files. Files are stored via PocketBase's `file` field API, backed by local disk in development and Cloudflare R2 (S3-compatible) in production. The `/collections/[slug]/editions/new` route becomes a thin "create draft → redirect" step, so all editing — including uploads — happens on the existing `/editions/[slug]/workflow` page via a shared component tree. An at-view SVX scene rewriter lets Voyager render the uploaded scene (annotations, tours, camera) as a live preview while the researcher is still editing.

Addresses issue #38: "File upload for edition cover images and 3D models."

## Non-Goals

- **MinIO** in `docker-compose.yml` — deferred; may be added later if CORS/streaming issues bite.
- **Article HTML files** referenced inside SVX scenes — PocketBase file fields are flat (no subdirectories) and we don't add an `articleFiles` multi-file field in this scope. Editions whose SVX depends on articles will render model/annotations fine but show broken article links. Tracked as a follow-up.
- **Migration** of files from local disk to R2 on environment switch.
- **Automated cleanup** of abandoned draft editions. Creation is deferred to first user interaction (not page mount) to keep this unnecessary for now.
- **End-to-end upload tests** against PocketBase. Manual verification only.

## Architecture

### Storage

PocketBase owns uploads via `file` fields on the `editions` collection. The backing store is controlled by PocketBase's Settings API:

- **Development**: empty `R2_*` env vars → setup script skips S3 configuration → PocketBase writes to `pocketbase/pb_data/storage/editions/<record_id>/<filename>`. Fully offline-capable.
- **Production**: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` set → setup script calls `pb.settings.update({ s3: { enabled: true, ... } })` → PocketBase streams uploads to R2. Application code is identical in both modes.

URLs are resolved through PocketBase (`<pb>/api/files/editions/<record_id>/<filename>`) regardless of backend. Switching backends later does not require code changes; existing files stay on their old backend (orphaned) unless manually migrated.

### Schema changes (`editions` collection)

Three new file fields added to `scripts/create-pocketbase-collections.ts` and `pocketbase/pb_schema/collections.json`:

| Field        | Type | `maxSize`             | `mimeTypes`                                                  | Notes                                                 |
|--------------|------|-----------------------|--------------------------------------------------------------|-------------------------------------------------------|
| `coverImage` | file | `20971520` (20 MB)    | `image/jpeg`, `image/png`, `image/webp`, `image/avif`        | Single file.                                          |
| `modelFile`  | file | `524288000` (500 MB)  | `application/octet-stream` + client-side extension check     | Accepted: `.glb`, `.gltf`, `.obj`, `.ply`.            |
| `sceneFile`  | file | `0` (unlimited)       | `application/json`                                           | SVX scene JSON.                                       |

`thumbnail:url` stays as-is for legacy fallback. Access rules match existing edition fields (author/editor writes own, authenticated reads).

### PocketBase request size

Default body limit is 32 MB. The `pocketbase-setup` service (already runs on every `docker compose up`) raises it by applying the appropriate request-body-size setting via `pb.settings.update(...)` alongside the S3 config — 524288000 bytes (500 MB). This keeps the config declarative from env vars rather than requiring a reverse proxy. Implementation pass may refine the exact settings key once verified against the current PocketBase version (v0.22+).

### Routing

- **`/collections/[slug]/editions/new`** becomes a bootstrap step. On first user interaction (title keystroke or file pick, whichever comes first), the page creates a draft edition record (`status=draft`, `title='Untitled draft'`, collection relation set, author added via `editionUsers`) and redirects to `/editions/<id>/workflow`. No form UI lives at `/new` anymore beyond the initial field(s).
- **`/editions/[slug]/workflow`** is the single place all editing happens. The existing disabled upload placeholders are replaced with the new `EditionAssetsPanel` component. Existing metadata form sections are untouched.

Deferring draft creation to first-interaction avoids orphan drafts from accidental navigations.

### Component layout (`src/lib/components/uploads/`)

- **`FileUploadField.svelte`** — generic, reusable. Props: `record`, `fieldName`, `accept` (MIME list), `maxSize`, `disabled`, plus a `preview` snippet so callers render the thumbnail/filename/viewer themselves. Uses `XMLHttpRequest` for progress tracking. Emits `uploaded`, `removed`, `error`.
- **`CoverImageUpload.svelte`** — wraps `FileUploadField` with image MIME types, 20 MB cap, thumbnail preview via `pb.files.getUrl(record, filename, { thumb: '400x300' })`.
- **`ModelFileUpload.svelte`** — wraps with 500 MB cap, client-side extension check, preview of filename + human-readable size + remove button.
- **`SceneFileUpload.svelte`** — wraps with JSON-only, preview of filename + "SVX scene" label.
- **`EditionAssetsPanel.svelte`** — composes the three uploaders + a `VoyagerPreview`. Single component mounted in both the redirected workflow page and any future place edition assets are edited. Props: `edition` record; emits `updated` so parent can refresh.
- **`VoyagerPreview.svelte`** — wraps the existing `VoyagerViewer` with the resolution-order logic from the Preview section below. Owns the rewriter plumbing and blob URL lifecycle.

`src/lib/utils/svx-uri-rewriter.ts` — pure rewriter utility. Unit-testable, no DOM.

### Upload flow per field

1. User picks a file. Client validates MIME + extension + size synchronously and rejects bad input before any network call.
2. `XMLHttpRequest` `PATCH`es the edition record with a `FormData` body containing the field. `onprogress` drives a progress bar (0–100%). An in-flight XHR is cancelled if the user re-picks.
3. On success, the record is re-fetched and the preview snippet renders the new file.
4. Replace = same flow (PocketBase overwrites a single-file field). Remove = `PATCH` with PocketBase's delete-file convention (`{ 'fieldName-': true }` or `{ fieldName: null }`).
5. Errors: inline error row under the field + toast + retry button that re-uses the previously picked `File`.

### Voyager preview & SVX rewriter

**`svx-uri-rewriter.ts`** exports `rewriteSceneJson(scene: object, fileMap: Record<basename, absoluteUrl>) → object`. Walks the parsed SVX JSON; for every `"uri"` string, takes its basename (e.g., `articles/foo.html` → `foo.html`), looks it up in `fileMap`, substitutes the absolute URL if matched, leaves it alone otherwise. Returns a new object (immutable).

**`VoyagerPreview.svelte` resolution order:**

1. If `sceneFile` is set → fetch scene JSON, build `fileMap` from `modelFile` + any other record files, rewrite, wrap as `new Blob([JSON.stringify(rewritten)], { type: 'application/json' })`, `URL.createObjectURL(blob)`, pass `root=""` and `document=<blob-url>` to `<voyager-explorer>`. Revoke the blob URL on unmount / scene change.
2. Else if `modelFile` is set → synthesize a minimal SVX scene JSON pointing at the model URL, blob it, hand to Voyager.
3. Else if the edition has legacy `pubNum` values and no uploaded files → current behavior: `root = getEditionRoot(collectionPubNum, editionPubNum)`, `document = 'scene.svx.json'`.
4. Else → "upload a model to see it here" placeholder.

### Asset URL helpers

`src/lib/utils/asset-urls.ts` keeps its current signatures but gains a "uploaded files win" preamble. New helper:

```ts
export function getEditionCoverUrl(edition: EditionRecord): string | null
```

Returns the PocketBase `coverImage` URL if set; else `edition.thumbnail` (legacy string URL); else the derived `getEditionThumbnailUrl(collectionPubNum, editionPubNum)` if `pubNum`s are present; else `null`.

`getEditionRoot` / `getEditionThumbnailUrl` keep working unchanged for legacy editions.

### Deployment config

**`.env.example`** — expand the existing R2 lines and add two:

```
# R2 / S3 settings (prod). Leave empty for local disk in dev.
R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

**`scripts/create-pocketbase-collections.ts`** — at the end of its existing run, if all four `R2_*` env vars are present, call `pb.settings.update({ s3: { enabled: true, endpoint, bucket, region: 'auto', accessKey, secret, forcePathStyle: true } })`. Missing env → no-op, S3 stays disabled. Idempotent across re-runs (the `pocketbase-setup` service runs on every `docker compose up`).

**`docker-compose.yml`** — `pocketbase-setup` service gains the four `R2_*` env vars so it can forward them into `pb.settings.update(...)`. The `pocketbase` service itself does not need them; all backend config lives in PocketBase's settings database after the setup step runs.

**R2 bucket CORS** — a one-time configuration step on the Cloudflare dashboard for the project owner, documented in `DEV.md`: allow `GET` + `PUT` from the production frontend origin. Not automatable via PocketBase. Not needed in dev (local disk).

### Error handling & edge cases

- **Upload failure** (network, 5xx, body too large): inline error row + toast + retry button (re-uses selected `File`).
- **Validation failure** (wrong MIME/ext/size): caught client-side before upload.
- **Scene JSON parse error**: fall back to Tier 1 model-only preview; toast warns "Scene file invalid — showing model only."
- **Draft creation failure on first interaction**: error toast; inputs stay disabled; user can retry by re-interacting.
- **Concurrent re-upload**: cancel the in-flight XHR before starting the new one.
- **Tab close during upload**: PocketBase receives partial body and rejects it; no orphan file.
- **`modelFile` removed while `sceneFile` still references it**: `fileMap` lookup misses → Voyager shows broken model. UI shows a warning badge ("Scene references a missing model"). No automatic scene deletion.
- **Legacy editions** (no uploaded files): render via existing CDN path (resolution step 3) — no regression.

### Testing

- **Unit** (`svx-uri-rewriter`): several cases — no URIs, nested URIs, subfolder refs, unmatched basename, malformed input.
- **Component** (`FileUploadField` via Vitest + Svelte testing): MIME rejection, size rejection, progress updates, removal. Stub `XMLHttpRequest`.
- **Integration (manual)**: local stack — upload 20 MB AVIF cover, upload 300 MB GLB with visible progress, upload SVX scene, confirm Voyager preview renders, remove model, confirm warning appears, verify Save Draft works mid-upload state.
- **Legacy smoke test**: open an imported edition's workflow page, confirm Voyager still renders from the CDN path.

Manual verification checklist lives in the PR description.

## Files touched (summary)

- **New**:
  - `src/lib/components/uploads/FileUploadField.svelte`
  - `src/lib/components/uploads/CoverImageUpload.svelte`
  - `src/lib/components/uploads/ModelFileUpload.svelte`
  - `src/lib/components/uploads/SceneFileUpload.svelte`
  - `src/lib/components/uploads/EditionAssetsPanel.svelte`
  - `src/lib/components/uploads/VoyagerPreview.svelte`
  - `src/lib/utils/svx-uri-rewriter.ts`
  - `src/lib/utils/svx-uri-rewriter.test.ts`
- **Modified**:
  - `pocketbase/pb_schema/collections.json` — add three file fields to `editions`.
  - `scripts/create-pocketbase-collections.ts` — create file fields + apply S3 settings when env present.
  - `docker-compose.yml` — pass `R2_*` env vars into `pocketbase-setup` service.
  - `.env.example` — add `R2_ENDPOINT`, `R2_BUCKET`; note local-disk default.
  - `src/routes/collections/[slug]/editions/new/+page.svelte` — reduce to the bootstrap step (first-interaction → create draft → redirect).
  - `src/routes/editions/[slug]/workflow/+page.svelte` — replace disabled upload placeholders with `<EditionAssetsPanel edition={...} />`.
  - `src/lib/utils/asset-urls.ts` — add `getEditionCoverUrl`; no signature changes.
  - `DEV.md` — document R2 CORS + `.env` setup for prod.
