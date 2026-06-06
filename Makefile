.PHONY: help db db-logs db-stop dev stack stack-stop

help:
	@echo "Pure3D commands"
	@echo "  make db          Start local PocketBase and print admin URL"
	@echo "  make db-logs     Follow PocketBase logs"
	@echo "  make db-stop     Stop local PocketBase services"
	@echo "  make dev         Run frontend dev server"
	@echo "  make stack       Start full Docker stack"
	@echo "  make stack-stop  Stop full Docker stack"

db:
	@docker compose up -d pocketbase pocketbase-setup
	@echo ""
	@echo "PocketBase admin: http://localhost:8090/_/"
	@echo "Health:           http://localhost:8090/api/health"

db-logs:
	docker compose logs -f pocketbase pocketbase-setup

db-stop:
	docker compose stop pocketbase pocketbase-setup

dev:
	bun run dev

stack:
	docker compose up

stack-stop:
	docker compose down
