# Volum

Volum is a self-hosted web file manager for Ubuntu and Docker home servers. It is designed around a reliable backend job engine so long-running filesystem operations (copy, move, delete, archive, upload) can continue on the server even if the browser window is closed.

## Features

- **File browsing** — Grid, list, and column (macOS Finder-style) views with sorting, hidden file toggle, favorites, and recents
- **File actions** — Create folder, rename, batch rename, copy, move, trash with restore, permanent delete
- **Background jobs** — Persistent SQLite-backed jobs with real-time SSE progress, cancel, retry (including per-item retry), pause/resume
- **Upload & download** — Upload with size verification, single-file download, streamed directory zip download
- **Archives** — Create and extract zip, tar, tar.gz
- **Metadata** — Info panel, permissions editor (chmod rwx toggles), checksums (md5/sha256), folder size and disk usage
- **Search** — Global search across all roots with content grep
- **Desktop view** — Drive icons (like "My Computer"), trash icon with badge count, desktop-style navigation
- **Sharing** — Create expiring share links with optional password and download limits
- **UX** — Context menus, keyboard shortcuts, rubber-band drag select, touch long-press on mobile, dark mode, loading skeletons, action toasts, browser notifications, undo for rename/restore
- **Auth** — Admin and readonly session-cookie auth with HMAC-signed cookies
- **Safety** — Copy via `.partial` temp files with size verification, safe move (copy+verify+delete), per-root `.volum-trash/` recycle bin, configurable conflict policies (ask, skip, overwrite, rename, cancel)

## Quick Start — Home Server

1. Create a directory for Volum data and clone the repo:
   ```sh
   mkdir -p /opt/docker/volum/data /opt/docker/volum/storage
   git clone https://github.com/shirishkoirala/volum /opt/docker/volum
   cd /opt/docker/volum
   ```

2. Create `.env`:
   ```env
   VOLUM_ADMIN_PASSWORD=your-strong-password
   VOLUM_SESSION_SECRET=$(openssl rand -base64 32)
   VOLUM_AUTH_REQUIRED=true
   VOLUM_ROOTS=/mnt/storage,/mnt/data,/opt/docker
   VOLUM_DATA_DIR=/opt/docker/volum/data
   VOLUM_STORAGE=/opt/docker/volum/storage
   VOLUM_PUBLIC_URL=https://volum.yourdomain.com
   ```

3. Start Volum:
   ```sh
   docker compose up --build -d
   ```

4. Open `http://your-server-ip:8090` and log in with the admin password.

For full server mode with host `/` access and automatic mounted-drive discovery, use `docker-compose.server.yml`:
```sh
docker compose -f docker-compose.server.yml up --build -d
```

## Development

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

Docker development (Vite hot reload):
```sh
docker compose -f docker-compose.dev.yml up --build
```

## Environment

```txt
VOLUM_ROOTS=/mnt/storage,/mnt/data1
VOLUM_DB=/data/volum.db
VOLUM_PORT=8090
VOLUM_ADMIN_PASSWORD=change-me
VOLUM_READONLY_PASSWORD=view-only
VOLUM_SESSION_SECRET=replace-with-a-long-random-string
VOLUM_AUTH_REQUIRED=true
VOLUM_INCLUDE_ROOT=true
VOLUM_DISCOVER_ROOTS=true
VOLUM_HOST_ROOT=/host
VOLUM_PUBLIC_URL=https://volum.example.com
```

Authentication is disabled when both password variables are empty. Set `VOLUM_ADMIN_PASSWORD` to require login and allow write operations only for the admin role. Set `VOLUM_READONLY_PASSWORD` to allow a browse/download-only account. Use a long random `VOLUM_SESSION_SECRET` so sessions survive restarts.

## Deployment

```sh
docker compose up --build -d
```

For homelab use, expose Volum only over a private network such as Tailscale or WireGuard. Avoid publishing it directly to the public internet.
