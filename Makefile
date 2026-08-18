.PHONY: help install db db-logs db-stop dev dev-web bun-dev seed-assets stack stack-stop

help:
	@echo "Pure3D commands"
	@echo "  make install     Install deps and provision local MinIO/PocketBase/Voyager"
	@echo "  make db          Start local MinIO + PocketBase and print URLs"
	@echo "  make db-logs     Follow PocketBase logs"
	@echo "  make db-stop     Stop local database/storage services"
	@echo "  make dev         Run full local dev app in Docker/OrbStack"
	@echo "  make dev-web     Run DB/MinIO in Docker, then native Bun frontend"
	@echo "  make bun-dev     Alias for dev-web"
	@echo "  make seed-assets Mirror static/project into local MinIO bucket"
	@echo "  make stack       Start full Docker stack"
	@echo "  make stack-stop  Stop full Docker stack"

install:
	@docker compose up -d minio minio-setup pocketbase pocketbase-setup voyager-setup
	@$(MAKE) seed-assets
	@echo ""
	@echo "Local services are installed and provisioned."
	@echo "Run 'make dev' to start the frontend container."

db:
	@docker compose up -d minio pocketbase
	@echo ""
	@echo "PocketBase admin: http://localhost:14274/_/"
	@echo "PocketBase health: http://localhost:14274/api/health"
	@echo "MinIO console:    http://localhost:14276"
	@echo "Asset bucket:     http://localhost:14275/pure3d-assets"

db-logs:
	docker compose logs -f minio minio-setup pocketbase pocketbase-setup

db-stop:
	docker compose stop minio minio-setup pocketbase pocketbase-setup

dev:
	docker compose up frontend

dev-web:
	@docker compose up -d minio minio-setup pocketbase pocketbase-setup voyager-setup
	@set -a; [ ! -f .env ] || . ./.env; set +a; \
		bun install && bun run dev --host 0.0.0.0 --port "$${FRONTEND_PORT:-14273}"

bun-dev: dev-web

seed-assets:
	@docker compose up -d minio minio-setup
	@if [ ! -d static/project ]; then \
		echo "No static/project directory found; nothing to seed."; \
		exit 0; \
	fi
	docker compose run --rm --entrypoint /bin/sh minio-setup -lc 'mc alias set local http://minio:9000 "$$MINIO_ROOT_USER" "$$MINIO_ROOT_PASSWORD" && mc mirror --overwrite /app/static/project local/$$R2_BUCKET/project'

stack:
	docker compose up

stack-stop:
	docker compose down
