#!/bin/bash
#  Create PocketBase Admin Account

echo "🔑 Creating PocketBase admin account..."
echo "   Email: ${POCKETBASE_ADMIN_EMAIL}"

docker compose exec pocketbase pocketbase superuser upsert \
  "${POCKETBASE_ADMIN_EMAIL}" \
  "${POCKETBASE_ADMIN_PASSWORD}"

echo ""
echo "✅ Admin account ready!"
echo "   You can now run: docker compose --profile setup run --rm pocketbase-setup"
