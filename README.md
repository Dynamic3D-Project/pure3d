![](https://github.com/NLeSC/.github/blob/main/profile/escience.png)

# Pure3D

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Research Software Directory](https://img.shields.io/badge/rsd-Pure_3D_Platform-00a3e3.svg)](https://research-software-directory.org/projects/pure3d)


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

### 1. Clone the repository

```sh
git clone <your-repo-url>
cd pure3D-26
```

### 2. Optional: create a local `.env`

If you do nothing, Docker Compose will use built-in defaults.

If you want different ports or admin credentials, copy the example file first:

```sh
cp .env.example .env
```

Important defaults:

- Frontend: `http://localhost:8080`
- PocketBase: `http://localhost:8090`
- PocketBase superuser: `admin@admin.local` / `1234567890`

### 3. Start everything with one command

```sh
docker compose up
```

This runs the frontend in **development mode** (Vite dev server with hot reload). What happens on a fresh clone:

1. Starts PocketBase
2. Creates or upgrades the PocketBase schema automatically
3. Imports the bundled JSON seed data from `data/json-output/` when those files are present
4. Seeds demo login accounts
5. Downloads the Voyager runtime into `static/voyager/0.59.0/` when it is missing
6. Starts the Vite dev server (with hot reload)

First startup can take a little longer because the setup container installs dependencies and imports the database.

For **production**, the app builds to static files (`bun run build`) and can be deployed to GitHub Pages or any static host.

### 4. Open the app

- Frontend: `http://localhost:8080`
- PocketBase admin UI: `http://localhost:8090/_/`

Demo app accounts created automatically for development:

- `superadmin@pure3d.eu` / `1234567890`
- `admin@pure3d.eu` / `1234567890`
- `editor@pure3d.eu` / `1234567890`
- `viewer@pure3d.eu` / `1234567890`

If no project data is available yet, the app still starts with an empty database, working authentication, and working role-based access. You can log in and manage users before any collection or edition data has been imported.

### 5. If you need a clean reset

```sh
docker compose down
rm -rf pocketbase/pb_data
docker compose up -d
```

## Data and Assets

There are two different kinds of local data in this repository:

### A. Database seed data

This is already used automatically by Docker Compose.

- Source folder: `data/json-output/`
- Purpose: initial PocketBase collections and records
- Result: imported automatically during `docker compose up` if the files exist

You do not need to manually place anything here after cloning unless you want to regenerate the dataset yourself from BSON files.

If you do want to rebuild the JSON seed data, the BSON source files belong in:

- `data/db/`

Then run:

```sh
bun scripts/read-bson.ts
```

### B. 3D static asset data

This is what the frontend uses for Voyager scenes, edition thumbnails, articles, and model files.

The 3D project assets (~7.5 GB) are stored on a **Cloudflare R2 bucket** and are not included in the repository. To access them you need the R2 credentials:

1. Ask a project maintainer for the `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
2. Add them to your `.env` file

The app looks for assets in two places depending on configuration:

- **With `PUBLIC_ASSET_BASE_URL` set**: assets are loaded from the R2/CDN URL (recommended for Docker and production)
- **With `PUBLIC_ASSET_BASE_URL` empty**: assets are served from the local `static/project/` directory

Asset path structure:

```text
static/
├── project/{collectionPubNum}/
│   ├── icon.png
│   └── edition/{editionPubNum}/
│       ├── scene.svx.json
│       ├── icon.png
│       ├── *.glb
│       └── articles/
└── voyager/{version}/
    ├── js/
    ├── css/
    ├── fonts/
    ├── images/
    └── language/
```

Voyager note:

- You should not commit Voyager runtime files.
- `docker compose up` downloads the official Smithsonian Voyager runtime into `static/voyager/0.59.0/` if it is missing.
- That folder is git-ignored.

Notes:

- If a page loads but a 3D scene or image is missing, check that `PUBLIC_ASSET_BASE_URL` is set or that the corresponding files exist under `static/project/`.
- The `static/project/` directory is git-ignored since the full asset set is too large for git.

### Production Deployment

For production, set `PUBLIC_ASSET_BASE_URL` to the R2 public URL:

```env
PUBLIC_ASSET_BASE_URL=https://assets.pure3d.eu
```

When empty, assets are served from local `static/` directory.

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

| Environment  | Example             | Meaning                                   |
|-------------|---------------------|-------------------------------------------|
| On a tag    | `v0.3.0`            | Exactly at release v0.3.0                 |
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

| Prefix | Category        |
|--------|-----------------|
| feat:  | Features        |
| fix:   | Bug Fixes       |
| docs:  | Documentation   |
| chore: | Maintenance     |
| feat!: | Breaking Changes|

## Resources

- [Smithsonian Voyager](https://smithsonian.github.io/dpo-voyager/)
- [SvelteKit](https://svelte.dev/docs/kit)
- [PocketBase](https://pocketbase.io/docs/)
- [TailwindCSS](https://tailwindcss.com/docs)
