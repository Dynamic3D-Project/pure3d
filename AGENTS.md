# AGENTS.md

## Workflow

- Use Bun as the package manager and runtime. Use the latest stable Bun unless a compatibility
  pin is added to the repository.
- Implement new features directly on `main` unless the user requests another branch or workflow.
- Preserve unrelated working-tree changes.
- Keep changes minimal and follow existing SvelteKit 2/Svelte 5 patterns.
- Do not commit, push, or open a pull request unless explicitly requested.
- Report failed checks and blockers clearly.
- Releases are intentional and local: `make release-dry-run` is read-only; `make release`
  requires explicit release authorization and clean synchronized `main`; builds locally, creates a
  commit/annotated tag, atomically pushes both, and publishes the exact archive plus checksum.
- Main pushes run checks only. Tag pushes deploy verified prebuilt Release archives via Pages;
  Actions must never build. Never push, publish, upload, sign, or access credentials
  as part of release implementation/testing. Preserve pending release state on failures.
- Follow [docs/releases.md](docs/releases.md) for release and GitHub Pages behavior.

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
make release-dry-run # offline preview; no writes or checks
make release      # explicitly authorized local release only
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
- Local host ports are frontend `60020`, PocketBase `60021`, MinIO API `60023`, MinIO console
  `60024`, and Vite preview `60025`. Container ports remain frontend `14273`, PocketBase `8090`,
  and MinIO `9000`/`9001`.
- Never commit `.env`, `data/`, `pocketbase/pb_data`, `minio/data`, logs, credentials, or private
  assets.
- Do not edit generated files such as `src/lib/paraglide/` unless intentionally regenerating them.
- Do not change service credentials, ports, or production data defaults unless required.

## Conventions

- Formatting is Prettier-controlled: tabs, single quotes, no trailing commas, 100-character width.
- Every Svelte component must have one root HTML element with an `id` matching the filename in
  kebab-case, for example `ProfileCard.svelte` uses `id="profile-card"`.
- Use `btn-primary` (forest) for the main Save, Publish, or submit action; use neutral/outline styles
  for supporting actions, accent for selected tools or highlights, and status colours only for status.

## Rich Content Editing

- Continue extending the existing Tiptap editor with reusable components that make content editing
  and public pages richer. Build on the Insert component menu and existing callouts, action links,
  edition grids, and expandable sections; do not replace the editor with a separate page builder.
- Add components for concrete editorial needs, using consistent site styling and limited options
  rather than arbitrary HTML, CSS, or layout controls. Keep CMS-only controls gated from other uses
  of the shared editor.
- Implement each component end to end: insertion and editing, HTML serialization and reopening,
  frontend sanitization, backend validation, and public rendering. Preserve existing content and
  allow only explicitly supported elements and attributes.
- Reuse existing site components and reference live records where appropriate instead of copying
  their metadata into page content. Handle missing or unpublished records safely.
- Verify nested content and save/reopen round-trips, hostile input sanitization, keyboard access,
  and responsive editor/public views when adding or changing components.
- Relevant files: `src/lib/components/ui/RichTextEditor.svelte`,
  `src/lib/utils/editor-content-components.ts`, `src/lib/utils/content-components.ts`,
  `src/lib/utils/content-html.ts`, `src/lib/content.ts`, `src/lib/components/content/`, and
  `pocketbase/pb_hooks/cms-service.cjs`.

## Key Directories

- `src/routes/` - pages, layouts, and endpoints
- `src/lib/` - shared components, database access, types, and utilities
- `pocketbase/` and `scripts/` - local backend hooks, setup, migrations, and imports
- `static/voyager/` - Smithsonian Voyager runtime assets
