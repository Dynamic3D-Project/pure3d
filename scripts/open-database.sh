#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

echo "Starting PocketBase..."
docker compose up -d pocketbase pocketbase-setup

echo ""
echo "PocketBase admin:"
echo "  http://localhost:8090/_/"
echo ""
echo "Health:"
echo "  http://localhost:8090/api/health"
