# Reset PocketBase Admin Account

If you're having authentication issues, follow these steps to reset:

## Option 1: Delete and Recreate

```bash
# Stop all services
docker compose down

# Delete PocketBase data
rm -rf pocketbase/pb_data

# Start PocketBase
docker compose up -d pocketbase

# Open admin UI and create new account
open http://localhost:7090/_/
```

**IMPORTANT**: When creating the admin account, use EXACTLY:
- Email: `admin@admin.com`
- Password: `adminadmin`

(These must match your `.env` file)

## Option 2: Change .env to Match Your Actual Admin

If you want to keep your existing admin account, update `.env` to match what you actually created:

```bash
# Edit .env file
nano .env

# Update these lines to match your actual credentials:
POCKETBASE_ADMIN_EMAIL=your-actual-email@example.com
POCKETBASE_ADMIN_PASSWORD=your-actual-password
```

## Verify It Works

After resetting, test authentication:

```bash
POCKETBASE_URL=http://localhost:7090 bun scripts/setup-pocketbase-simple.ts
```

You should see:
```
✅ Authenticated successfully
   Admin ID: xxxxx
   Admin Email: admin@admin.com
```

## Then Run Full Setup

```bash
docker compose --profile setup up pocketbase-setup
```
