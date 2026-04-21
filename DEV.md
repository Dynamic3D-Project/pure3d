## Component ID Convention

Every Svelte component **must** have an `id` attribute on its root HTML element, using kebab-case derived from the component filename. This makes components identifiable in the DOM for debugging, testing, and programmatic access.

- `ProfileCard.svelte` → `<div id="profile-card">`
- `HearingTest.svelte` → `<div id="hearing-test">`
- `CreateProfileModal.svelte` → `<div id="create-profile-modal">`

If a component has multiple root elements (fragment), wrap them in a `<div id="component-name">...</div>`.

## R2 storage (production)

In development, PocketBase stores uploaded edition assets on local disk (`pocketbase/pb_data/storage/`). In production we use Cloudflare R2 as an S3-compatible backend.

### One-time R2 bucket setup

1. Create an R2 bucket (e.g., `pure3d-uploads`) in the Cloudflare dashboard.
2. Create an R2 API token with Object Read + Write on that bucket. Note the Access Key ID, Secret Access Key, and endpoint (`https://<account>.r2.cloudflarestorage.com`).
3. Apply a CORS policy on the bucket permitting `GET` and `PUT` from the production frontend origin:

```json
[
  {
    "AllowedOrigins": ["https://<your-frontend-domain>"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Environment variables

In the production `.env`:

```
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_BUCKET=pure3d-uploads
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

The `pocketbase-setup` container applies these to PocketBase's storage settings on every `docker compose up`. No code changes are required to switch between local disk (dev) and R2 (prod).

### Switching an existing dev environment to R2

1. Fill in the four `R2_*` env vars.
2. Restart the stack: `docker compose down && docker compose up -d`.
3. The setup service logs `📦 Configuring S3 storage (R2)` when it runs.

Files already on local disk remain there (orphaned). Migrating them is out of scope for this setup — uploads from this point forward flow to R2.