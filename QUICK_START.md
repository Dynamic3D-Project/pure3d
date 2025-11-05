# PocketBase Quick Start - 3 Steps

## Step 1: Create Admin Account (First Time Only)

```bash
# Start PocketBase
docker compose up -d pocketbase

# Open admin UI in browser
open http://localhost:7090/_/
```

**Create your admin account when prompted:**
- Email: `admin@pure3d.local` (or use the email in your `.env`)
- Password: (use the password from your `.env`)

⚠️ **Important**: Use the SAME credentials as in your `.env` file:
- `POCKETBASE_ADMIN_EMAIL`
- `POCKETBASE_ADMIN_PASSWORD`

## Step 2: Create Collections & Import Data

```bash
# This will:
# 1. Create all 7 collections automatically
# 2. Import all 832 documents from your MongoDB backup

docker compose --profile setup up pocketbase-setup
```

**Expected output:**
```
🚀 Creating PocketBase Collections
✅ Authenticated

📦 Creating collection: users
   ✅ Created successfully

📦 Creating collection: site
   ✅ Created successfully

...

📦 Importing users...
   Progress: 76/76
   ✅ Imported 76/76 users

...

✅ All collections created successfully!
✅ Import completed successfully!
```

## Step 3: Start Frontend

```bash
docker compose up -d frontend
```

Access your app at: **http://localhost:7080**

---

## Verification

Check that everything worked:

```bash
# Check PocketBase
open http://localhost:7090/_/

# You should see 7 collections with data:
# - users (76)
# - site (1)
# - keywords (305)
# - projects (22)
# - editions (110)
# - projectUsers (48)
# - editionUsers (270)
```

---

## Troubleshooting

### "Authentication failed"
- Make sure you used the SAME credentials from `.env` when creating the admin account
- Check `.env` file has `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` set

### "Collections already exist"
- That's OK! The script will skip existing collections
- Data import will also skip if data already exists

### Start Fresh
```bash
# Stop everything
docker compose down

# Delete PocketBase data
rm -rf pocketbase/pb_data

# Start over from Step 1
docker compose up -d pocketbase
```

---

## What Next?

Your PocketBase database is now ready with all your MongoDB data!

You can:
1. Browse data in admin UI: http://localhost:7080/_/
2. Query via API: http://localhost:7090/api/collections/projects/records
3. Use in your SvelteKit app (see `POCKETBASE_SETUP.md` for examples)

