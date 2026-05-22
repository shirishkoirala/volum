# Volum

Volum is a self-hosted web file manager for Ubuntu and Docker home servers. It is designed around a reliable backend job engine so long-running filesystem operations can continue after the browser closes.

## Current Scope

This repository starts the MVP foundation:

- Go API server
- Configurable storage roots via `VOLUM_ROOTS`
- Optional Linux server mode with host `/` and mounted drive discovery
- Server-side path validation
- SQLite schema for persistent jobs
- File listing API
- Job API skeleton with persistent state
- React + TypeScript frontend shell
- Docker and Compose deployment files

## Development

Mac Docker:

```sh
mkdir -p storage data
docker compose up --build
```

Open `http://localhost:8090`. The default Compose file exposes only the local `./storage` folder inside Volum, with SQLite stored in `./data/volum.db`.

Mac Docker development with Vite frontend:

```sh
mkdir -p storage data
docker compose -f docker-compose.dev.yml up --build
```

Open `http://localhost:5174` for the frontend dev server. The API runs at `http://localhost:8090`, and the frontend container proxies `/api` and `/healthz` to the API container.

Backend:

```sh
cd backend
go run ./cmd/volum
```

Frontend:

```sh
cd frontend
npm install
npm run dev
```

## Environment

```txt
VOLUM_ROOTS=/mnt/storage,/mnt/data1,/mnt/data2,/mnt/backup,/opt/docker
VOLUM_DB=/data/volum.db
VOLUM_PORT=8090
VOLUM_ADMIN_PASSWORD=change-me
VOLUM_READONLY_PASSWORD=view-only
VOLUM_SESSION_SECRET=replace-with-a-long-random-string
VOLUM_AUTH_REQUIRED=true
VOLUM_INCLUDE_ROOT=true
VOLUM_DISCOVER_ROOTS=true
VOLUM_HOST_ROOT=/host
```

Authentication is disabled when both password variables are empty. Set `VOLUM_ADMIN_PASSWORD` to require login and allow write operations only for the admin role. Set `VOLUM_READONLY_PASSWORD` to allow a browse/download-only account. Use a long random `VOLUM_SESSION_SECRET` so sessions survive restarts.

## Deployment

```sh
docker compose -f docker-compose.homelab.yml up --build
```

The homelab Compose file exposes Volum on port `8090` and stores the SQLite database under `/opt/docker/volum`.

For homelab use, expose Volum only over a private network such as Tailscale or WireGuard. Avoid publishing it directly to the public internet.

For full Linux server mode with host `/` and automatic mounted-drive discovery, see `docs/linux-server.md` and `docker-compose.server.yml`.
