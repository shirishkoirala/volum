SHELL := /bin/sh

DEV_COMPOSE := docker compose -f docker-compose.dev.yml
TEST_COMPOSE := docker compose -f docker-compose.test.yml
FRONTEND_RUN := $(DEV_COMPOSE) run --rm --no-deps frontend sh -c
FRONTEND_TEST_FILTER := $(strip $(if $(FILE),$(FILE)) $(if $(NAME),-t "$(NAME)"))
BACKEND_TEST_FILTER := $(strip $(if $(NAME),-run "$(NAME)"))
PACKAGE ?= ./...

.DEFAULT_GOAL := help

.PHONY: help setup doctor dev dev-detached stop status logs clean-dev clean-test \
	check check-frontend check-backend test-frontend test-backend \
	coverage coverage-frontend coverage-backend \
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
		'  make clean-test       Remove the isolated backend test network and cache' \
		'' \
		'Verification:' \
		'  make check            Run all required frontend and backend checks' \
		'  make check-frontend   Typecheck, format-check, lint, test, and build frontend' \
		'  make check-backend    Lint, vet, test, and build backend' \
		'  make test-frontend    Run frontend tests; optional FILE=... NAME=...' \
		'  make test-backend     Run Go tests; optional PACKAGE=... NAME=...' \
		'  make format-frontend  Format frontend source files' \
		'  make build            Build the production image' \
		'  make smoke            Run the authenticated disposable smoke test' \
		'  make smoke-proxy      Run the reverse-proxy upload smoke test' \
		'' \
		'Coverage (informational):' \
		'  make coverage-frontend  Run frontend tests with coverage' \
		'  make coverage-backend   Run Go tests with coverage' \
		'  make coverage           Run both frontend and backend coverage'

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

clean-test:
	$(TEST_COMPOSE) down --remove-orphans --volumes

check: check-frontend check-backend

check-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run typecheck && npm run format:check && npm run lint && npm run test:ci && npm run build'

check-backend:
	docker build --target backend-base .

test-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run test:ci -- $(FRONTEND_TEST_FILTER)'

test-backend:
	$(TEST_COMPOSE) run --rm --build backend-test go test $(BACKEND_TEST_FILTER) $(PACKAGE)

coverage-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run test:coverage'

coverage-backend:
	$(TEST_COMPOSE) run --rm --build backend-test go test -coverprofile=coverage.out -covermode=atomic $(BACKEND_TEST_FILTER) ./...

coverage: coverage-frontend coverage-backend

format-frontend:
	$(FRONTEND_RUN) 'sh ./scripts/ensure-dependencies.sh && npm run format'

build:
	docker compose build

smoke:
	./scripts/smoke.sh

smoke-proxy:
	./scripts/smoke-reverse-proxy-upload.sh
