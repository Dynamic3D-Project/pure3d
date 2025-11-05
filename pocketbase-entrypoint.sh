#!/bin/sh
set -e

echo "🔧 PocketBase Entrypoint - Initializing..."

# Data directory
DATA_DIR="/pb/pb_data"

# Create superuser if credentials are provided
if [ -n "$POCKETBASE_ADMIN_EMAIL" ] && [ -n "$POCKETBASE_ADMIN_PASSWORD" ]; then
    echo "📝 Creating/updating superuser: $POCKETBASE_ADMIN_EMAIL"
    echo "   Using data directory: $DATA_DIR"

    # Use superuser upsert with the correct data directory
    pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" --dir="$DATA_DIR" || {
        echo "⚠️  Superuser upsert command not available, trying create..."
        pocketbase superuser create "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" --dir="$DATA_DIR" 2>/dev/null || \
        echo "ℹ️  Superuser might already exist or will be created on first access"
    }

    echo "✅ Superuser ready"
else
    echo "⚠️  No admin credentials provided, skipping superuser creation"
fi

echo "🚀 Starting PocketBase server..."

# Execute the main command (passed as arguments to this script)
exec "$@"
