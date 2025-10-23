#!/bin/bash

# Export PocketBase schema to pb_schema/collections.json
# This script helps export your current PocketBase schema

POCKETBASE_URL="${POCKETBASE_URL:-http://localhost:8090}"
OUTPUT_FILE="./pocketbase/pb_schema/collections.json"

echo "📤 Exporting PocketBase schema..."
echo "PocketBase URL: $POCKETBASE_URL"

# Note: You need to manually export via PocketBase Admin UI
# This is because PocketBase doesn't have a direct API endpoint for schema export
#
# To export:
# 1. Go to $POCKETBASE_URL/_/
# 2. Navigate to Settings → Import/Export
# 3. Click "Export collections"
# 4. Save the file to: pocketbase/pb_schema/collections.json

echo "📋 Manual export steps:"
echo "1. Open your browser to: ${POCKETBASE_URL}/_/"
echo "2. Go to Settings → Import/Export"
echo "3. Click 'Export collections'"
echo "4. Save to: $OUTPUT_FILE"

echo ""
echo "💡 Tip: This will overwrite the existing schema file"
