# Private sandbox implementation checkpoint

## Completed locally

- Sandboxes are `editions` with server-owned `isSandbox` and `sandboxOwner` fields.
- Signed-in users create up to three through a dedicated hook endpoint, receive author membership,
  and can edit and delete only their own sandbox.
- Sandboxes remain draft-only, cannot be assigned to a collection, reviewed, or published, and are
  excluded from editorial-board reads by the editions access rules.
- They are inaccessible to everyone except their owner, including administrators; private files
  follow the same owner-only rule.
- Transfer copies sandbox editor metadata and all editor files (including the Voyager scene that
  contains annotations, tours, and articles) into the owner’s empty, concept-approved edition.
  It deliberately retains the sandbox after copy, rejects stale sources, and rejects non-empty
  targets rather than overwriting their title, attribution, review choice, or editor content.
- Sandbox files are bounded: 20 companion files at 100 MB each, plus the existing 500 MB model,
  500 MB Voyager scene, and 20 MB cover-image limits (about 2.95 GiB maximum across file fields).
- A local PocketBase backup was verified, the sandbox schema/rules migration was applied to the
  local Docker database, and PocketBase was restarted successfully.
- Local feature checks exercised owner/non-owner record and file access, membership rejection,
  the sandbox/file limits, and transfer/reopen with cleanup of all temporary records.

## Production deployment — 21 October 2026

- Authorised scope only: `sandbox-service.cjs`, sandbox changes staged onto the installed versions
  of `orcid-service.cjs`, `orcid.pb.js`, `review-service.cjs`, and
  `admin-workflow-service.cjs`, plus the `editions` sandbox fields, index, and access rules.
  No frontend, content, uploads, credentials, unrelated hooks, release, commit, or push was changed.
- The VPS service was rediscovered as `pure3d-archive-pocketbase-1`, using the read-only
  `/opt/pure3d-archive/platform/pocketbase/pb_hooks` host mount at `/pb/pb_hooks`.
- A fresh PocketBase backup was created through the production API, listed with a non-zero size,
  and passed `unzip -t` with `data.db`, `auxiliary.db`, and `types.d.ts` present:
  `/opt/pure3d-archive/platform/pocketbase/pb_data/backups/sandbox-backup-diagnostic.zip`.
- A complete, root-owned hooks backup was retained at
  `/var/backups/pure3d-sandbox-hooks-20261021T145948Z/hooks` with a 15-file SHA-256 manifest.
- `bun --env-file=.env scripts/migrate-sandbox-schema.ts --production` was run only after the
  production URL origin and dedicated production credentials were checked. The script preserves
  existing fields and indexes, replacing only the sandbox fields/index and the two access rules.
- Production had unrelated hook drift from the local checkout (`feedback-email.pb.js`,
  `orcid-readiness.cjs`, `orcid-validation.cjs`, `publication-service.cjs`, and
  `storage-dashboard.pb.js`), and the local `orcid.pb.js`/`admin-workflow-service.cjs` also carried
  unrelated proposal-review/unpublish work. Those changes were not deployed; the five authorised
  files were staged from the installed production baseline and syntax-checked before upload.
- Installed SHA-256 after restart: `sandbox-service.cjs`
  `0eec4ac9ee2f5913c43af98f3714337bc26065216ac9e7fe17712cf83d751c25`,
  `orcid-service.cjs` `30bf4ea5683bf092cc02922a2b1c59699b4a80e77147110d3836cc88929a32b3`,
  `orcid.pb.js` `055b2dda3ef304d65af9042f37ed8be1268cd47a5bd2f38b10462d1da80d24fb`,
  `review-service.cjs` `4413007ef956749609bb3369da52ae3dc9cef62bb87f424eb447212d9581a4a9`,
  and `admin-workflow-service.cjs`
  `2b3df0b26d0329928de0d50aff7da629b7f7d6ccaf6eb3e7470b6b320b94dbad`.
- Verification passed: VPS `127.0.0.1:8090/api/health`, public `/api/health`, production
  `_superusers` authentication, schema read-back, unauthenticated sandbox-filter read (200 with
  zero items), and unauthenticated `POST /api/pure3d/sandboxes` (401, confirming registration
  without creating content).

### Rollback

If the hooks need rollback, stop `pure3d-archive-pocketbase-1`, remove `sandbox-service.cjs`, copy
the four replaced files from `/var/backups/pure3d-sandbox-hooks-20261021T145948Z/hooks`, restore
their `ubuntu:ubuntu` ownership, and restart that container. The schema was not destructively rolled
back; the verified PocketBase backup is retained for an explicitly authorised recovery procedure.

Actual production sandbox create/save/transfer/publish journeys remain unverified because no
production content was created or edited.
