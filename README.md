# Pure3D

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
cd pure3D-26
bun install
```

2. **Start development**

```sh
docker compose up
```

This starts:
- Frontend at `http://localhost:8080`
- PocketBase at `http://localhost:8090`

3. **Setup PocketBase** (first run only)

Visit `http://localhost:8090/_/` to create your admin account, then import the database schema from `pocketbase/pb_schema/collections.json`

## Development Commands

```sh
# Start development
docker compose up

# Run locally (without Docker)
bun run dev

# Build for production
bun run build

# Format and lint
bun run format
bun run lint
```

## Project Structure

```
src/
├── routes/              # SvelteKit pages
├── lib/
│   ├── components/      # Reusable components
│   ├── data/           # Collections and editions data
│   └── types/          # TypeScript types
pocketbase/
├── pb_data/            # Database files
└── pb_schema/          # Schema exports
```

## Resources

- [Smithsonian Voyager](https://smithsonian.github.io/dpo-voyager/)
- [SvelteKit](https://svelte.dev/docs/kit)
- [PocketBase](https://pocketbase.io/docs/)
- [TailwindCSS](https://tailwindcss.com/docs)
