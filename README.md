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

1. **Clone and install**

```sh
git clone <your-repo-url>
cd pure3D
```

2. **Start development**
It will set up the frontend and Backend fully. If not set .env all values will be created by default.
```sh
docker compose up -d
```

This starts:
- Frontend at `http://localhost:8080`
- PocketBase at `http://localhost:8090`

3. **Setup PocketBase** (first run only)

Visit `http://localhost:8090/_/` to create your admin account, then import the database schema from
`pocketbase/pb_schema/collections.json`

## 3D Edition Assets

The platform serves 3D content from static assets. These large files (~9 GB) are git-ignored.

### Directory Structure

```
static/
├── project/{pubNum}/                    # Per-project data
│   ├── icon.png                         # Collection thumbnail
│   └── edition/{pubNum}/                # Per-edition data
│       ├── scene.svx.json               # Voyager scene file
│       ├── *.glb                        # 3D models
│       ├── icon.png                     # Edition thumbnail
│       └── articles/                    # HTML content
└── voyager/{version}/                   # Voyager viewer versions
    ├── js/voyager-explorer.min.js
    ├── fonts/, css/, images/
    └── language/
```

### Local Development

Copy your 3D edition data to `static/project/` and Voyager builds to `static/voyager/`.
Assets are served at `/project/...` and `/voyager/...` routes in dev mode.

### Image Optimization (Optional)

For better performance, optimize thumbnails to AVIF/WebP formats:

```sh
bun add sharp  # Install dependency
bun scripts/optimize-images.ts  # Convert PNG → AVIF/WebP
```

### Production Deployment

For production, host assets on Cloudflare R2 or another CDN and set:

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
