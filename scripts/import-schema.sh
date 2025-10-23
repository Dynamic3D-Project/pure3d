#!/bin/bash

# Import PocketBase schema from pb_schema/collections.json
# This script imports the collections schema into a running PocketBase instance

POCKETBASE_URL="${POCKETBASE_URL:-http://localhost:8090}"
SCHEMA_FILE="./pocketbase/pb_schema/collections.json"

echo "🔄 Importing PocketBase schema..."
echo "PocketBase URL: $POCKETBASE_URL"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Error: Schema file not found at $SCHEMA_FILE"
    exit 1
fi

# Note: You need to manually import via PocketBase Admin UI
# This is because PocketBase doesn't have a direct API endpoint for schema import
#
# To import:
# 1. Go to $POCKETBASE_URL/_/
# 2. Navigate to Settings → Import/Export
# 3. Click "Import collections"
# 4. Select pocketbase/pb_schema/collections.json
# 5. Review and confirm the import

echo "📋 Manual import steps:"
echo "1. Open your browser to: ${POCKETBASE_URL}/_/"
echo "2. Go to Settings → Import/Export"
echo "3. Click 'Import collections'"
echo "4. Select: $SCHEMA_FILE"
echo "5. Review and confirm"

echo ""
echo "💡 Tip: The schema file is located at: $SCHEMA_FILE"
