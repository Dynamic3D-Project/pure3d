.PHONY: help install db db-logs db-stop dev seed-assets stack stack-stop

help:
	@echo "Pure3D commands"
	@echo "  make install     Install deps and provision local MinIO/PocketBase/Voyager"
	@echo "  make db          Start local MinIO + PocketBase and print URLs"
	@echo "  make db-logs     Follow PocketBase logs"
	@echo "  make db-stop     Stop local database/storage services"
	@echo "  make dev         Run full local dev app in Docker/OrbStack"
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
	@echo "PocketBase admin: http://localhost:8090/_/"
	@echo "PocketBase health: http://localhost:8090/api/health"
	@echo "MinIO console:    http://localhost:9001"
	@echo "Asset bucket:     http://localhost:9000/pure3d-assets"

db-logs:
	docker compose logs -f minio minio-setup pocketbase pocketbase-setup

db-stop:
	docker compose stop minio minio-setup pocketbase pocketbase-setup

dev:
	docker compose up frontend

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
