![](https://raw.githubusercontent.com/NLeSC/.github/24b2ff028f19395c636c2aea9fb9570f6fa35e59/profile/escience.png)

# Pure3D

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Research Software Directory](https://img.shields.io/badge/rsd-Pure_3D_Platform-00a3e3.svg)](https://research-software-directory.org/projects/pure3d-20)

A web platform for exploring 3D digital collections and editions in cultural heritage, built with modern web technologies.

![readme](./README.excalidraw.png)

## About

Pure3D provides an interactive way to view and explore 3D digitized artifacts, artworks, and cultural heritage objects. The platform features:

- Browse curated collections of 3D editions
- Interactive 3D viewing powered by Smithsonian Voyager
- Fast, seamless navigation between 3D models
- Responsive design for desktop and mobile

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5
- **Styling**: TailwindCSS 4 + DaisyUI
- **3D Viewer**: Smithsonian Voyager
- **Backend**: PocketBase
- **Runtime**: Bun

## Quick Start

### Full local stack (recommended)

Use local PocketBase and MinIO so development changes stay off live services. Docker Compose, Bun, and mkcert are required for the workflows below (`brew install mkcert` on macOS).

```sh
git clone <your-repo-url>
cd pure3D-26
make dev
```

Open `https://127.0.0.1:60020`. `make dev` first runs `make dev-cert` to trust the development CA and generate missing certificates, then selects local endpoints even if an existing `.env` points to production. You do not need to replace that file. For a new checkout, `.env.example` documents optional local settings.

Startup provisions local MinIO, PocketBase schema and available seed data, installs Voyager, and starts the Docker frontend. It does not apply an ORCID OAuth cutover. For a native Bun frontend with the same local services, use `make dev-web` (`make bun-dev` is an alias).

Get private database seed data from a project maintainer and place it in `data/json-output/`. Obtain local 3D assets separately under `static/project/`, then run `make seed-assets` to mirror them into MinIO. `make install` provisions services and seeds available assets without starting the frontend.

- PocketBase admin UI: `http://localhost:60021/_/`
- MinIO console: `http://localhost:60024`
- Local assets: `http://localhost:60023/pure3d-assets`

Local ORCID sign-in reuses the **existing real ORCID application and account**, with a separate local application database. Add `https://127.0.0.1:60020/api/oauth2-redirect` to the application's allowed callbacks without replacing the OVH callback or application URL. No sandbox is needed. See [Development](docs/development.md) for certificate trust, custom-port callbacks, and explicit provider configuration.

### Local frontend against live OVH (explicit opt-in)

**Connected to production: changes affect live data.**

```sh
make dev-prod
```

Open `http://localhost:60020` in this mode. Only the frontend container starts (`--no-deps`); no certificate prerequisite, local setup, or production service management runs. HTTPS development routing is explicitly disabled. Its endpoints are fixed to the OVH URLs below, regardless of `PUBLIC_*` values in `.env`. Existing local services are not stopped.

## Data and Assets

### Explicit service selection

`make dev` and all local aliases select local services. Only `make dev-prod` selects these live endpoints:

| Service    | URL                                          | Purpose                                           |
| ---------- | -------------------------------------------- | ------------------------------------------------- |
| PocketBase | `https://main.57-129-98-223.sslip.io`        | Collections, editions, users (same-origin `/api`) |
| Assets     | `https://main.57-129-98-223.sslip.io/assets` | 3D models, scenes, thumbnails                     |

The confirmed OVH target is `ubuntu@57.129.98.223`, with containers under `/opt/pure3d-archive`. `pure3d.eu` DNS has not moved; `pure3d-database.ctwhome.com` points to a different legacy server, not this target.

`PUBLIC_*` settings do not select the mode of these Make commands. Existing port variables and `R2_BUCKET` still customize local URLs.

### Database seed data (Docker only)

The `data/` directory is git-ignored because it contains user information. It is only needed when running a local PocketBase with Docker Compose.

- `data/json-output/` - JSON files imported automatically by `make dev`
- `data/db/` - BSON source files for regenerating the JSON seed data

To regenerate JSON from BSON:

```sh
bun scripts/read-bson.ts
```

Ask a project maintainer for the seed data files if you need a local database.

### 3D assets

The 3D project assets (~7.5 GB) are served through the OVH `/assets` prefix and are not included in the repository. Legacy `project/...` paths are unchanged. The `static/project/` directory is git-ignored.

Local commands force MinIO asset URLs; `make dev-prod` forces the OVH assets endpoint. Neither inherits `PUBLIC_ASSET_BASE_URL` from `.env`. Direct build commands still use their supplied build environment.

Local asset structure (for offline development):

```text
static/project/{collectionPubNum}/
├── icon.png
└── edition/{editionPubNum}/
    ├── scene.svx.json
    ├── icon.png
    ├── *.glb
    └── articles/
```

### Voyager runtime

The [Smithsonian Voyager](https://smithsonian.github.io/dpo-voyager/) 3D viewer is committed under `static/voyager/0.59.0/` (production-minified files only). It is served from the app's static folder in both development and on GitHub Pages.

## Deployment

The app deploys to **GitHub Pages** as a static site. Pushing to `main` triggers an automatic deploy via the GitHub Actions workflow (`.github/workflows/deploy.yml`).

Build environment:

```env
APP_BASE_PATH=/pure3d
PUBLIC_POCKETBASE_URL=https://main.57-129-98-223.sslip.io
PUBLIC_ASSET_BASE_URL=https://main.57-129-98-223.sslip.io/assets
```

# Features

### Pure3D Frontend

- [-] Fix scrollbar layout shift on navigation (added `scrollbar-gutter: stable`)
- [x] Optimize Voyager iframe loading with persistent iframe architecture
- [x] Add SvelteKit prefetching to all navigation links
- [x] Add Voyager background gradient for seamless loading
  - [ ] Add next/previous navigation on edition pages
  - [ ] Implement edition comparison view
  - [ ] Add keyboard shortcuts for navigation

### Pure3D Backend

### Installation scripts

- [x] Docker compose
- [ ] Automigration files on first run
- [ ]
- Docs
  - [ ] Docker Compose

## Versioning & Releases

This project uses tag-triggered releases with automatic changelog generation.

### How It Works

- Version comes from git tags (e.g., `v0.3.0`)
- Pushing a tag triggers GitHub Actions to generate a changelog and create a GitHub Release
- Dev server shows your exact git state via `git describe --tags`

### Version Display

| Environment   | Example             | Meaning                                   |
| ------------- | ------------------- | ----------------------------------------- |
| On a tag      | `v0.3.0`            | Exactly at release v0.3.0                 |
| After commits | `v0.3.0-5-ga1b2c3d` | 5 commits after v0.3.0, at commit a1b2c3d |

### Creating a Release

```sh
# Work with conventional commits
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git push origin main

# When ready to release
git tag v0.4.0
git push --tags
```

### Conventional Commits

| Prefix | Category         |
| ------ | ---------------- |
| feat:  | Features         |
| fix:   | Bug Fixes        |
| docs:  | Documentation    |
| chore: | Maintenance      |
| feat!: | Breaking Changes |

## Resources

- [Smithsonian Voyager](https://smithsonian.github.io/dpo-voyager/)
- [SvelteKit](https://svelte.dev/docs/kit)
- [PocketBase](https://pocketbase.io/docs/)
- [TailwindCSS](https://tailwindcss.com/docs)
