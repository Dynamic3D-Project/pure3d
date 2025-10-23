# SvelteKit + PocketBase Template

A modern full-stack template using SvelteKit for the frontend and PocketBase as the backend database.




## Tech Stack

- **Frontend**: SvelteKit 2 with Svelte 5
- **Backend**: PocketBase (embedded SQLite database with real-time subscriptions)
- **Styling**: TailwindCSS 4
- **Runtime**: Bun
- **Containerization**: Docker Compose

![readme](./README.excalidraw.png)

## Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- [Bun](https://bun.sh/) (for local development outside Docker)

## Quick Start

1. **Clone the repository**

```sh
git clone <your-repo-url>
cd top-svelte-pocketbase
```

2. **Start the development environment**

```sh
docker compose up
```

This will start:
- **PocketBase** at `http://localhost:8090`
- **Frontend** at `http://localhost:8080`

**Note**: The `.env` file is optional. Default ports are used if not specified. To customize, create a `.env` file:

```sh
cp .env.example .env
```

3. **Set up PocketBase Admin**

On first run, visit `http://localhost:8090/_/` to create your admin account.

4. **Import Database Schema**

Choose one of the following methods to set up the database schema:

### Method 1: Import Collections (Recommended for Quick Start)

1. Go to `http://localhost:8090/_/`
2. Navigate to **Settings** → **Import/Export**
3. Click **"Import collections"**
4. Select `pocketbase/pb_schema/collections.json`
5. Review and click **"Confirm"**

### Method 2: Automatic Migrations (Recommended for Development)

Migrations are automatically applied when PocketBase starts. The `pocketbase/pb_migrations/` directory contains:
- `1_initial_schema.js` - Creates the todos collection with proper schema and API rules

To verify migrations:
1. Check PocketBase logs on startup
2. Go to `http://localhost:8090/_/` and verify the `todos` collection exists

### What's Included

The schema includes:
- **users** collection (built-in auth)
  - Email/password authentication
  - Minimum 8 character passwords

- **todos** collection
  - `name` (text, required) - Todo task name
  - `completed` (boolean) - Completion status
  - `Description` (text, optional) - Additional details
  - `user` (relation) - Owner of the todo
  - API Rules: Users can only see/edit their own todos

- **posts** collection
  - `title` (text, required) - Post title
  - `content` (editor) - Post content (supports rich text/markdown)
  - Auto-generated `created` and `updated` timestamps

## Development

### Using Docker Compose (Recommended)

```sh
# Start services
docker compose up

# Start in detached mode
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Rebuild containers
docker compose up --build
```

### Local Development (Without Docker)

If you prefer to run locally:

```sh
# Install dependencies
bun install

# Start dev server
bun run dev
```

**Note**: You'll need to run PocketBase separately for local development.

## Project Structure

```
.
├── src/              # SvelteKit application
├── static/           # Static assets
├── scripts/          # Utility scripts
│   ├── seed-data.ts      # Generate test data with Faker.js
│   ├── export-schema.sh  # Export PocketBase schema
│   └── import-schema.sh  # Import PocketBase schema
├── pocketbase/       # PocketBase database files
│   ├── pb_data/          # PocketBase data (auto-generated, gitignored)
│   ├── pb_schema/        # PocketBase schema exports
│   │   └── collections.json  # Collections schema
│   ├── pb_migrations/    # PocketBase migrations
│   │   └── 1_initial_schema.js  # Initial schema migration
│   └── pb_backups/       # PocketBase backups
├── docker-compose.yml
└── README.md
```

## PocketBase

### Admin Dashboard

Access the PocketBase admin UI at: `http://localhost:8090/_/`

### Creating Collections

1. Go to the admin dashboard
2. Navigate to "Collections"
3. Create your collections and define schemas
4. Collections are automatically available via the REST API and real-time subscriptions

### API Endpoints

PocketBase automatically generates REST API endpoints:

- `GET /api/collections/{collection}/records` - List records
- `GET /api/collections/{collection}/records/{id}` - Get record
- `POST /api/collections/{collection}/records` - Create record
- `PATCH /api/collections/{collection}/records/{id}` - Update record
- `DELETE /api/collections/{collection}/records/{id}` - Delete record

### Real-time Subscriptions

PocketBase supports real-time subscriptions for all collections. See the [PocketBase SDK documentation](https://pocketbase.io/docs/client-side-integration/) for implementation details.

### Schema Management

#### Export Current Schema

To export your current PocketBase schema (useful after making changes):

```sh
./scripts/export-schema.sh
```

This will guide you through exporting collections from the PocketBase admin UI to `pocketbase/pb_schema/collections.json`.

#### Import Schema

To import the schema into a fresh PocketBase instance:

```sh
./scripts/import-schema.sh
```

Or follow the manual steps:
1. Go to `http://localhost:8090/_/`
2. Settings → Import/Export → Import collections
3. Select `pocketbase/pb_schema/collections.json`

#### Migrations

Migrations in `pocketbase/pb_migrations/` are automatically applied on PocketBase startup. To add new migrations:

1. Make changes in PocketBase admin
2. PocketBase can auto-generate migrations (see [PocketBase migrations docs](https://pocketbase.io/docs/migrations/))
3. Or manually create migration files in `pocketbase/pb_migrations/`

### Seeding Test Data

For performance testing and development, you can generate bulk test data using the seeding script:

```sh
bun run seed
```

This will prompt you for:
- Admin credentials for authentication
- User email to assign todos to (default: user@user.com)
- Whether to clear existing todos and posts first

The script generates:
- **1000 todos** with realistic names and descriptions
- **500 blog posts** with varied content

Features:
- Uses [Faker.js](https://fakerjs.dev/) for realistic test data
- Batched creation (100 records at a time) to avoid overwhelming the API
- Progress tracking with real-time updates
- Reusable - can be run multiple times

**Note**: Make sure PocketBase is running (`docker compose up`) before running the seed script.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POCKETBASE_PORT` | PocketBase port | 8090 |
| `FRONTEND_PORT` | Frontend dev server port | 8080 |
| `PUBLIC_POCKETBASE_URL` | PocketBase URL for browser | http://localhost:8090 |
| `POCKETBASE_URL` | PocketBase URL for server-side requests | http://pocketbase:8090 |
| `NODE_ENV` | Environment mode | development |

## Building for Production

```sh
# Build the frontend
bun run build

# Preview the production build
bun run preview
```

For production deployment, you'll need to:
1. Build the SvelteKit app
2. Deploy PocketBase with persistent storage
3. Configure environment variables for your production URLs

## Additional Commands

```sh
# Format code
bun run format

# Lint code
bun run lint

# Type check
bun run check

# Seed test data
bun run seed
```

## Resources

- [SvelteKit Documentation](https://svelte.dev/docs/kit)
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte)
- [PocketBase Documentation](https://pocketbase.io/docs/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Bun Documentation](https://bun.sh/docs)

## License

[Your License Here]
