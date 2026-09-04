#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

echo "Starting PocketBase..."
docker compose up -d pocketbase pocketbase-setup

echo ""
echo "PocketBase admin:"
echo "  http://localhost:60021/_/"
echo ""
echo "Health:"
echo "  http://localhost:60021/api/health"
