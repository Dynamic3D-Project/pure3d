#!/bin/sh
set -eu

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
	sleep 1
done

mc mb --ignore-existing "local/$R2_BUCKET"
mc anonymous set download "local/$R2_BUCKET"

cat > /tmp/cors.json <<'EOF'
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
EOF

mc cors set /tmp/cors.json "local/$R2_BUCKET" || true
