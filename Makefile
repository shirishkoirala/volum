SHELL := /bin/sh

DEV_COMPOSE := docker compose -f docker-compose.dev.yml
FRONTEND_RUN := $(DEV_COMPOSE) run --rm frontend sh -c

.DEFAULT_GOAL := help

.PHONY: help setup doctor dev dev-detached stop status logs clean-dev \
	check check-frontend check-backend test-frontend test-backend \
	format-frontend build smoke smoke-proxy

help:
	@printf '%s\n' \
		'Volum contributor commands' \
		'' \
		'Setup and development:' \
		'  make setup            Prepare local directories and verify prerequisites' \
		'  make doctor           Check Docker, architecture, ports, and directories' \
		'  make dev              Build and start the development stack' \
		'  make dev-detached     Build and start the development stack in the background' \
		'  make stop             Stop the development stack' \
		'  make status           Show development containers' \
		'  make logs             Follow development logs' \
		'  make clean-dev        Remove dev containers and dependency volume (keeps data)' \
		'' \
		'Verification:' \
		'  make check            Run all required frontend and backend checks' \
		'  make check-frontend   Typecheck, format-check, lint, test, and build frontend' \
		'  make check-backend    Lint, vet, test, and build backend' \
		'  make test-frontend    Run serialized frontend tests' \
		'  make test-backend     Run backend checks and tests' \
		'  make format-frontend  Format frontend source files' \
		'  make build            Build the production image' \
		'  make smoke            Run the authenticated disposable smoke test' \
		'  make smoke-proxy      Run the reverse-proxy upload smoke test'

setup:
	@mkdir -p data storage
	@sh scripts/doctor.sh
	@printf '\nSetup complete. Run "make dev", then open http://localhost:8342.\n'

doctor:
	@sh scripts/doctor.sh

dev:
	@printf 'Starting Volum at http://localhost:8342 ...\n'
	$(DEV_COMPOSE) up --build

dev-detached:
	@printf 'Starting Volum at http://localhost:8342 ...\n'
	$(DEV_COMPOSE) up --build -d
	@$(DEV_COMPOSE) ps

stop:
	$(DEV_COMPOSE) down --remove-orphans

status:
	$(DEV_COMPOSE) ps

logs:
	$(DEV_COMPOSE) logs --follow --tail=100

clean-dev:
	@printf 'Removing development containers and the frontend dependency volume.\n'
	@printf 'Files under data/ and storage/ will be preserved.\n'
	$(DEV_COMPOSE) down --remove-orphans --volumes

check: check-frontend check-backend

check-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run typecheck && npm run format:check && npm run lint && npm run test:ci && npm run build'

check-backend:
	docker build --target backend-base .

test-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run test:ci'

test-backend: check-backend

format-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run format'

build:
	docker compose build

smoke:
	./scripts/smoke.sh

smoke-proxy:
	./scripts/smoke-reverse-proxy-upload.sh
