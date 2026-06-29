# AGENTS.md

Guidance for working in this repository.

## Project

Pure3D is a SvelteKit web platform for exploring 3D digital collections and editions.

- Frontend: SvelteKit 2, Svelte 5, TypeScript
- Styling: TailwindCSS 4, DaisyUI
- Runtime/package manager: Bun
- Backend/data: PocketBase
- Local object storage: MinIO through Docker Compose
- 3D viewer: Smithsonian Voyager assets under `static/voyager/`

## Commands

Use the smallest command that verifies the change.

```sh
make install      # provision local MinIO, PocketBase, Voyager, and dependencies
make dev          # run full local dev app in Docker/OrbStack
make db           # start MinIO and PocketBase only
make bun-dev      # run services in Docker and frontend with native Bun
bun run check     # Svelte/TypeScript check
bun run lint      # Prettier check and ESLint
bun run build     # production build
```

Default local URLs:

- Frontend: `http://localhost:8080`
- PocketBase admin: `http://localhost:8090/_/`
- MinIO console: `http://localhost:9001`
- Asset bucket: `http://localhost:9000/pure3d-assets`

## Code Layout

- `src/routes/` - SvelteKit pages, layouts, and endpoints
- `src/lib/components/` - reusable Svelte components
- `src/lib/database/` - PocketBase client, stores, and data helpers
- `src/lib/utils/` - shared utility functions
- `src/lib/types/` - shared TypeScript types
- `src/lib/paraglide/` - generated localization output
- `static/` - public static assets, including Voyager runtime files
- `pocketbase/` - local PocketBase data and migrations/setup state
- `scripts/` - setup, migration, import, and asset scripts
- `docs/` - project documentation and implementation notes

## Style

- Follow existing SvelteKit and Svelte 5 patterns in nearby files.
- Prefer existing components, utilities, stores, and types before adding new ones.
- Keep changes small and local; avoid speculative abstractions.
- Formatting is Prettier-controlled: tabs, single quotes, no trailing commas, 100 character print width.
- Every Svelte component must have an `id` on its root HTML element, using kebab-case from the filename. Example: `ProfileCard.svelte` uses `id="profile-card"`.
- If a Svelte component would have multiple root elements, wrap them in one root element with the required `id`.

## Data And Storage

- Frontend-only development can use the default production PocketBase and R2 asset URLs.
- Full local development uses Docker Compose services for PocketBase and MinIO.
- Historical imported assets use the legacy `project/<collection>/<edition>/...` path layout in the asset bucket.
- New uploads are stored through PocketBase file fields and served from PocketBase file URLs.

## Safety

- Do not commit secrets or local state: `.env`, `data/`, `pocketbase/pb_data`, `minio/data`, logs, or large private assets.
- Keep generated files out of edits unless the command being run intentionally regenerates them.
- Do not change local service credentials or ports unless the task requires it.
- For UI, routing, upload, permission, or data-loading changes, test in a browser when feasible.

## Verification

- For TypeScript/Svelte changes, run `bun run check` when feasible.
- For formatting or lint-sensitive edits, run `bun run lint` when feasible.
- For production-impacting changes, run `bun run build` when feasible.
- For UI changes, verify the affected page in the running app, preferably against the local Docker stack.
