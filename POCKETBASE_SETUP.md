# PocketBase Migration Guide

This guide walks you through migrating your MongoDB backup data to PocketBase.

## Overview

Your MongoDB backup contains 7 collections with 832 total documents:
- **users** (76) - User accounts with roles and permissions
- **site** (1) - Site configuration
- **keywords** (305) - Controlled vocabulary (countries, periods, etc.)
- **projects** (22) - Main project entries
- **editions** (110) - Project editions/versions with Voyager 3D content
- **projectUsers** (48) - User-project relationships
- **editionUsers** (270) - User-edition relationships

## Database Schema

### Entity Relationships

```
site (1)
  └── projects (n)
        ├── editions (n)
        │     ├── editionUsers (n) ──> users (n)
        │     └── [sceneFile reference to Voyager content]
        └── projectUsers (n) ──> users (n)

keywords (independent controlled vocabulary)
```

### Key Features

1. **Dublin Core Metadata**: Full Dublin Core metadata support for scholarly content
2. **Role-Based Access**: Four-tier permission system (root, admin, editor, viewer)
3. **Voyager Integration**: Scene file paths stored in editions for 3D content
4. **Publication Workflow**: Draft/published states with publication tracking
5. **Relationships**: Many-to-many user relationships at both project and edition levels

## Prerequisites

### 1. Install PocketBase

Download PocketBase from https://pocketbase.io/docs/

```bash
# macOS/Linux
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_darwin_amd64.zip
unzip pocketbase_0.22.0_darwin_amd64.zip
chmod +x pocketbase

# Or use Homebrew
brew install pocketbase
```

### 2. Project Structure

Your project should have:
```
pure3D-26/
├── pb_migrations/
│   └── 1730000000_initial_schema.js
├── pb_data/                 # Created automatically
├── data/
│   ├── db/                  # Original BSON files
│   └── json-output/         # Converted JSON files
└── scripts/
    ├── read-bson.ts
    └── import-to-pocketbase.ts
```

## Setup Steps

### Step 1: Start PocketBase

```bash
# Start PocketBase server
./pocketbase serve

# Server will run at: http://127.0.0.1:8090
```

### Step 2: Create Admin Account

1. Open http://127.0.0.1:8090/_/ in your browser
2. Create your admin account (first-time setup)
3. Note down your credentials - you'll need them for import

### Step 3: Apply Migration

The migration will be automatically applied when PocketBase starts. Verify collections were created:

1. Go to http://127.0.0.1:8090/_/#/collections
2. You should see 7 collections:
   - users
   - site
   - keywords
   - projects
   - editions
   - projectUsers
   - editionUsers

### Step 4: Convert BSON to JSON (if not done)

```bash
bun scripts/read-bson.ts
```

This creates `data/json-output/*.json` files from your BSON backup.

### Step 5: Import Data

```bash
bun scripts/import-to-pocketbase.ts admin@example.com your-password
```

Replace with your actual admin credentials from Step 2.

**Import Order** (automatically handled):
1. Site
2. Users
3. Keywords
4. Projects
5. Editions
6. ProjectUsers
7. EditionUsers

### Step 6: Verify Import

Check the collections in PocketBase admin UI:
- http://127.0.0.1:8090/_/#/collections/users
- http://127.0.0.1:8090/_/#/collections/projects
- http://127.0.0.1:8090/_/#/collections/editions

## Collection Details

### Users Collection

Stores user accounts with authentication integration.

**Fields:**
- `user` (text) - SHA hash identifier from original system
- `email` (email) - User email address
- `nickname` (text) - Display name
- `role` (select) - root | admin | editor | viewer

**Access Rules:**
- List/View: Authenticated users only
- Create/Update: Root or admin
- Delete: Root only

### Site Collection

Single record storing site-wide configuration.

**Fields:**
- `name` (text) - Site name
- `blog` (url) - Blog/website URL
- `lastPublished` (date) - Last publish timestamp
- `processing` (bool) - Processing flag
- `featured` (json) - Featured project IDs
- `publishedProjectCount` (number) - Published count
- `sweeperStartTm` (date) - Maintenance task timestamp
- `dcDateCreated/Modified` (date) - Dublin Core dates

**Access Rules:**
- List/View: Public
- Create: Root only
- Update: Root or admin
- Delete: None (prevent deletion)

### Keywords Collection

Controlled vocabulary for metadata fields.

**Fields:**
- `name` (select) - Vocabulary type (country, period, audience, subject, language, license, funder)
- `value` (text) - The actual value

**Indexes:**
- Unique composite index on (name, value)
- Index on name for filtering

**Access Rules:**
- List/View: Public
- Create/Update: Root or admin
- Delete: Root only

### Projects Collection

Main project entries with Dublin Core metadata.

**Fields:**
- `title` (text) - Project title
- `siteId` (relation) - Link to site
- `isVisible` (bool) - Visibility flag
- `lastPublished` (date) - Publication timestamp
- `pubNum` (number) - Publication number
- Dublin Core fields (dc prefix):
  - `dcTitle/dcSubtitle` (text)
  - `dcCreator/dcContributor/dcInstitution` (json arrays)
  - `dcAbstract/dcDescription` (rich text)
  - `dcSubject` (json array)
  - `dcCoveragePeriod/dcCoveragePlace` (text)
  - `dcLanguage` (json array)
  - `dcDateCreated/dcDateModified` (date)

**Indexes:**
- siteId, isVisible, pubNum

**Access Rules:**
- List/View: Public if visible, otherwise authenticated
- Create/Update: Root, admin, or editor
- Delete: Root or admin

### Editions Collection

Project editions/versions containing 3D content references.

**Fields:**
- `title` (text) - Edition title
- `projectId` (relation) - Parent project
- `isPublished` (bool) - Publication status
- `pubNum` (number) - Publication number
- Extended Dublin Core fields (more detailed than projects):
  - All project DC fields plus:
  - `dcContact` (email)
  - `dcKeyword/dcAudience/dcFunder/dcSource` (json arrays)
  - `dcProvenance` (rich text)
  - `dcCoverageCountry/dcCoveragePeriod` (json arrays)
  - `dcCoverageTemporal/dcCoverageGeo` (text)
  - `dcRightsHolder/dcRightsLicense` (text)
  - `dcDatePublished/dcDateUnPublished` (date)
- Voyager Integration:
  - `authorToolName` (text) - "Voyager"
  - `authorToolVersion` (text) - Version string
  - `sceneFile` (text) - Path to Voyager .svx scene file

**Indexes:**
- projectId, isPublished, pubNum

**Access Rules:**
- List/View: Public if published, otherwise authenticated
- Create/Update: Root, admin, or editor
- Delete: Root or admin

### ProjectUsers Collection

Many-to-many relationship between users and projects.

**Fields:**
- `projectId` (relation) - Project reference
- `userId` (relation) - User reference
- `user` (text) - User hash (for legacy compatibility)
- `role` (select) - admin | editor | viewer

**Indexes:**
- Unique composite index on (projectId, userId)
- Individual indexes on both IDs

**Access Rules:**
- List/View: Authenticated users
- Create/Update/Delete: Root or admin

### EditionUsers Collection

Many-to-many relationship between users and editions.

**Fields:**
- `editionId` (relation) - Edition reference
- `userId` (relation) - User reference
- `user` (text) - User hash (for legacy compatibility)
- `role` (select) - admin | editor | viewer

**Indexes:**
- Unique composite index on (editionId, userId)
- Individual indexes on both IDs

**Access Rules:**
- List/View: Authenticated users
- Create/Update/Delete: Root or admin

## Using PocketBase in Your SvelteKit App

### 1. Install PocketBase SDK

```bash
bun add pocketbase
```

### 2. Create PocketBase Client

```typescript
// src/lib/pocketbase.ts
import PocketBase from 'pocketbase';

export const pb = new PocketBase('http://127.0.0.1:8090');

// Enable auto-cancellation for SSR
pb.autoCancellation(false);

// Types (generate with: npx pocketbase-typegen)
export interface User {
  id: string;
  user: string;
  email: string;
  nickname: string;
  role: 'root' | 'admin' | 'editor' | 'viewer';
  created: string;
  updated: string;
}

export interface Project {
  id: string;
  title: string;
  siteId: string;
  isVisible: boolean;
  lastPublished?: string;
  pubNum?: number;
  dcTitle?: string;
  dcSubtitle?: string;
  dcCreator?: string[];
  dcContributor?: string[];
  dcInstitution?: string[];
  dcAbstract?: string;
  dcDescription?: string;
  dcSubject?: string[];
  dcCoveragePeriod?: string;
  dcCoveragePlace?: string;
  dcLanguage?: string[];
  dcDateCreated?: string;
  dcDateModified?: string;
  created: string;
  updated: string;
}

export interface Edition {
  id: string;
  title: string;
  projectId: string;
  isPublished: boolean;
  pubNum?: number;
  // All DC fields...
  authorToolName?: string;
  authorToolVersion?: string;
  sceneFile?: string; // Path to Voyager .svx file
  created: string;
  updated: string;
}
```

### 3. Example Queries

```typescript
// Get all published projects
const projects = await pb.collection('projects').getList(1, 50, {
  filter: 'isVisible = true',
  sort: '-lastPublished',
  expand: 'siteId'
});

// Get project with editions
const project = await pb.collection('projects').getOne('PROJECT_ID', {
  expand: 'editions(projectId)'
});

// Get published editions for a project
const editions = await pb.collection('editions').getList(1, 50, {
  filter: `projectId = "${projectId}" && isPublished = true`,
  sort: '-dcDatePublished'
});

// Get edition with Voyager scene file
const edition = await pb.collection('editions').getOne('EDITION_ID');
const voyagerScenePath = edition.sceneFile; // Use to load Voyager viewer

// Get keywords by type
const countries = await pb.collection('keywords').getFullList({
  filter: 'name = "country"',
  sort: 'value'
});

// Get user's project roles
const userProjects = await pb.collection('projectUsers').getList(1, 50, {
  filter: `userId = "${userId}"`,
  expand: 'projectId'
});

// Search projects by Dublin Core fields
const searchResults = await pb.collection('projects').getList(1, 20, {
  filter: `dcTitle ~ "Irish" || dcAbstract ~ "Irish"`,
  sort: '-lastPublished'
});
```

### 4. Authentication Integration

```typescript
// Authenticate user
await pb.collection('users').authWithPassword(email, password);

// Check user role
const isAdmin = pb.authStore.model?.role === 'admin' ||
                pb.authStore.model?.role === 'root';

// Subscribe to auth state
pb.authStore.onChange((token, model) => {
  console.log('Auth changed:', model);
});
```

## Troubleshooting

### Migration Not Applied

If collections aren't created:
1. Check `pb_migrations/` folder exists
2. Stop PocketBase and delete `pb_data/` folder
3. Restart PocketBase (migration runs on first start)

### Import Fails

**Authentication error:**
- Verify admin credentials
- Ensure PocketBase is running on correct port

**Relation not found:**
- Import runs in order automatically
- If manually importing, follow the order in the script

**Duplicate key errors:**
- Check if data already imported
- Delete records and re-import

### Performance Issues

For large datasets:
- Increase batch size in import script
- Disable realtime subscriptions during import
- Use indexes (already defined in migration)

## Next Steps

1. **Generate TypeScript Types:**
   ```bash
   bun add -D pocketbase-typegen
   bunx pocketbase-typegen --out src/lib/pocketbase-types.ts
   ```

2. **Setup SvelteKit Integration:**
   - Create stores for PocketBase client
   - Add authentication flows
   - Build project/edition listing pages

3. **Integrate Voyager Viewer:**
   - Use `sceneFile` path from editions
   - Load Voyager viewer with scene files
   - Display 3D content in your app

4. **Add File Storage:**
   - Configure PocketBase file storage
   - Upload 3D models, textures, documents
   - Link to editions

## Resources

- [PocketBase Documentation](https://pocketbase.io/docs/)
- [PocketBase JavaScript SDK](https://github.com/pocketbase/js-sdk)
- [SvelteKit Integration Guide](https://github.com/pocketbase/js-sdk#ssr-integration)
- [Dublin Core Metadata](https://www.dublincore.org/specifications/dublin-core/)
- [Voyager Documentation](https://smithsonian.github.io/dpo-voyager/)

## Support

Issues with:
- **Migration Schema**: Check `pb_migrations/1730000000_initial_schema.js`
- **Import Script**: Check `scripts/import-to-pocketbase.ts`
- **BSON Conversion**: Check `scripts/read-bson.ts`

Run scripts with `--help` flag for more options (when implemented).
