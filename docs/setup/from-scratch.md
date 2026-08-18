# Complete Setup From Scratch

> Preferred local setup is now the one-command flow in `README.md` and `docs/setup/quick-start.md`:
>
> ```bash
> docker compose up -d
> ```
>
> That command now starts PocketBase, applies the schema, imports `data/json-output/`, seeds demo users, and starts the frontend automatically.
>
> Use the instructions below only if you specifically need to regenerate the JSON data from BSON or inspect the manual setup flow.

## Prerequisites

- Docker Desktop installed and running
- Bun installed
- MongoDB BSON backup in `data/db/` folder

## Step 1: Convert BSON to JSON (One-time)

```bash
bun scripts/read-bson.ts
```

**What this does:**
- Reads all `.bson` files from `data/db/`
- Converts them to JSON format
- Saves to `data/json-output/`
- Creates `_database_structure.json` with schema overview

**Expected output:**
```
Found 7 BSON files in data/db
✅ Saved 76 documents to data/json-output/user.json
✅ Saved 1 documents to data/json-output/site.json
...
✅ Complete database structure saved
```

## Step 2: Configure Credentials

Edit `.env` file:

```bash
# PocketBase Admin Credentials
POCKETBASE_ADMIN_EMAIL=your-email@example.com
POCKETBASE_ADMIN_PASSWORD=your-secure-password
```

⚠️ **Important**: Remember these credentials - you'll use them to access the admin UI later!

## Step 3: Start Fresh PocketBase

```bash
# Clean any previous data
docker compose down
rm -rf pocketbase/pb_data

# Start PocketBase
docker compose up -d pocketbase
```

**Wait for:** `✅ PocketBase is ready` (about 5 seconds)

## Step 4: Run Complete Automated Setup

```bash
docker compose --profile setup up
```

**What this does automatically:**
1. ✅ Creates admin account with credentials from `.env`
2. ✅ Creates all 7 collections:
   - site
   - users
   - keywords
   - projects
   - editions
   - projectUsers
   - editionUsers
3. ✅ Configures all field schemas (Dublin Core metadata, relations, etc.)
4. ✅ Sets up relationships between collections
5. ✅ Imports all 832 documents from JSON files

**Expected output:**
```
🚀 Complete PocketBase Setup
✅ PocketBase is ready
✅ Authenticated successfully

📦 Creating basic collections...
   ✅ site created
   ✅ users created
   ✅ keywords created
   ✅ projects created
   ✅ editions created
   ✅ projectUsers created
   ✅ editionUsers created

🔗 Updating relation fields...
   ✅ projects.siteId → site
   ✅ editions.projectId → projects
   ...

📥 Starting data import...
📦 Importing site...
   ✅ Imported 1/1 site record(s)
📦 Importing users...
   ✅ Imported 76/76 users
📦 Importing keywords...
   ✅ Imported 305/305 keywords
📦 Importing projects...
   ✅ Imported 22/22 projects
📦 Importing editions...
   ✅ Imported 110/110 editions
📦 Importing projectUsers...
   ✅ Imported 48/48 project-user relationships
📦 Importing editionUsers...
   ✅ Imported 270/270 edition-user relationships

✅ COMPLETE SETUP FINISHED!

💡 Database Summary:
   ✅ site (1 record)
   ✅ users (76 records)
   ✅ keywords (305 records)
   ✅ projects (22 records)
   ✅ editions (110 records)
   ✅ projectUsers (48 records)
   ✅ editionUsers (270 records)

   Total: 832 documents imported!

🎉 Your PocketBase is ready to use!
```

## Step 5: Verify Setup

1. **Open Admin UI:**
   ```bash
   open http://localhost:14274/_/
   ```

2. **Login with your credentials** (from `.env`)

3. **Check collections** in the sidebar - you should see all 7

4. **Browse data** - click any collection to see imported records

## Step 6: Start Frontend (Optional)

```bash
docker compose up -d frontend
```

Access your app at: http://localhost:14273

---

## Complete Command Summary

```bash
# Full setup from scratch
bun scripts/read-bson.ts                    # Convert BSON → JSON (one-time)
docker compose down && rm -rf pocketbase/pb_data  # Clean slate
docker compose up -d pocketbase             # Start PocketBase
docker compose --profile setup up           # Auto setup (admin + collections + data)
docker compose up -d frontend               # Start app (optional)
```

---

## Troubleshooting

### "Authentication failed"
- Check `.env` credentials match exactly
- Make sure no typos in email/password

### "Collection already exists"
- This is OK! The script skips existing collections
- If collections have no fields, do a fresh start:
  ```bash
  docker compose down
  rm -rf pocketbase/pb_data
  # Then start from Step 3
  ```

### "Data already exists"
- The script automatically skips import if data exists
- To re-import, delete data via Admin UI or start fresh

### Port conflicts
- Change `POCKETBASE_PORT` in `.env` (default: 14274)
- Change `FRONTEND_PORT` in `.env` (default: 14273)

### Docker network errors
- Run: `docker network prune -f`
- Then restart from Step 3

---

## What Gets Created

### Collections with Full Schemas:

1. **site** - Site configuration
   - 9 fields (name, blog, featured, dates, etc.)

2. **users** - User accounts
   - 4 fields (user hash, email, nickname, role)

3. **keywords** - Controlled vocabulary
   - 2 fields (name, value)

4. **projects** - Main projects with Dublin Core
   - 18 fields (title, metadata, dates, etc.)

5. **editions** - 3D editions with Voyager scenes
   - 33 fields (full Dublin Core + Voyager config)
   - **Important**: `sceneFile` field stores path to `.svx` files

6. **projectUsers** - User-project permissions
   - 4 fields (projectId, userId, user hash, role)

7. **editionUsers** - User-edition permissions
   - 4 fields (editionId, userId, user hash, role)

### Relationships:
- site → projects (one-to-many)
- projects → editions (one-to-many)
- projects ↔ users (many-to-many via projectUsers)
- editions ↔ users (many-to-many via editionUsers)

---

## Next Steps After Setup

1. **Explore the data** in Admin UI
2. **Test API endpoints:**
   ```bash
   curl http://localhost:14274/api/collections/projects/records
   ```
3. **Integrate with SvelteKit** - see `POCKETBASE_SETUP.md` for examples
4. **Build your frontend** using the PocketBase SDK

---

## Files Reference

- `scripts/read-bson.ts` - BSON to JSON converter
- `scripts/setup-pocketbase-complete.ts` - Complete automated setup
- `docker-compose.yml` - Docker configuration with setup profile
- `.env` - Configuration (credentials, ports)
- `data/json-output/` - Converted JSON data
- `pocketbase/pb_data/` - PocketBase database (persistent)

---

## Support

- Admin UI: http://localhost:14274/_/
- Health check: http://localhost:14274/api/health
- Collections API: http://localhost:14274/api/collections

**Everything automated. Just 4 commands. Done! 🚀**
