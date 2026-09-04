# AGENTS.md

## Workflow

- Use Bun as the package manager and runtime. Use the latest stable Bun unless a compatibility
  pin is added to the repository.
- Implement new features directly on `main` unless the user requests another branch or workflow.
- Preserve unrelated working-tree changes.
- Keep changes minimal and follow existing SvelteKit 2/Svelte 5 patterns.
- Do not commit, push, or open a pull request unless explicitly requested.
- Report failed checks and blockers clearly.

## Commands

```sh
bun install       # install dependencies
make install      # provision local services, Voyager, and assets
make dev          # run the full local Docker stack
make dev-prod     # run the Docker frontend against production services
make db           # run PocketBase and MinIO only
make dev-web      # run services in Docker and the frontend with Bun
bun run check     # Svelte and TypeScript checks
bun run lint      # Prettier and ESLint checks
bun run build     # production build
```

## Verification

- Run the smallest relevant check after changes.
- Run `bun run check` for TypeScript or Svelte changes and `bun run lint` for formatting or lint
  changes.
- Run `bun run build` for production-impacting changes.
- Browser-test affected UI, routing, upload, permission, or data-loading behavior when feasible.

## Architecture And Safety

- The app uses SvelteKit's static adapter with an SPA fallback; do not assume a persistent
  application server at deployment.
- PocketBase is the data backend. MinIO emulates object storage locally; deployed assets may use
  R2. Preserve the legacy `project/<collection>/<edition>/...` asset paths.
- Never commit `.env`, `data/`, `pocketbase/pb_data`, `minio/data`, logs, credentials, or private
  assets.
- Do not edit generated files such as `src/lib/paraglide/` unless intentionally regenerating them.
- Do not change service credentials, ports, or production data defaults unless required.

## Conventions

- Formatting is Prettier-controlled: tabs, single quotes, no trailing commas, 100-character width.
- Every Svelte component must have one root HTML element with an `id` matching the filename in
  kebab-case, for example `ProfileCard.svelte` uses `id="profile-card"`.

## Key Directories

- `src/routes/` - pages, layouts, and endpoints
- `src/lib/` - shared components, database access, types, and utilities
- `pocketbase/` and `scripts/` - local backend hooks, setup, migrations, and imports
- `static/voyager/` - Smithsonian Voyager runtime assets
