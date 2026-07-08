# Contributing To Volum

Thanks for helping improve Volum. This project is a self-hosted desktop-style
file manager, so changes should keep file operations safe, predictable, and
usable on real server storage.

## Development Setup

Use Docker for development unless there is a specific reason to run a local
frontend command.

```sh
docker compose -f docker-compose.dev.yml up --build
```

The development frontend is served through the compose stack on port `8342`.

Production-style server build:

```sh
docker compose -f docker-compose.server.yml up --build -d
```

## Required Checks

Run lint and type-check before starting or testing a changed frontend UI:

```sh
docker compose -f docker-compose.dev.yml run --rm frontend npm run typecheck
docker compose -f docker-compose.dev.yml run --rm frontend npm run format:check
docker compose -f docker-compose.dev.yml run --rm frontend npm run lint
```

Run a production build before opening a pull request when possible:

```sh
docker compose -f docker-compose.server.yml build
```

Run backend lint, vet, and tests through Docker when you need a focused
backend check:

```sh
docker build --target backend-base .
```

Local frontend fallbacks are available when Docker is not practical:

```sh
cd frontend
npm run typecheck
npm run format:check
npm run lint
npm run build
```

Go is expected to be verified through Docker in this repository. Avoid relying
on local Go tooling unless you know the local environment is configured.

## Pull Request Workflow

1. Create a focused branch for the change.
2. Keep the diff scoped to the requested behavior.
3. Update documentation or screenshots when user-visible behavior changes.
4. Run the required checks.
5. Open a draft pull request if the work still needs review or visual QA.

Do not commit generated or local runtime data:

- `data/`
- `storage/`
- `frontend/dist/`
- `frontend/node_modules/`

## Code Organization

### Backend

The backend lives in `backend/`.

| Package | Purpose |
|---|---|
| `cmd/volum/` | Application entry point |
| `internal/api/` | HTTP routes, handlers, auth middleware |
| `internal/files/` | File listing, trash, disk usage |
| `internal/jobs/` | SQLite-backed job engine |
| `internal/auth/` | Sessions, roles, signed cookies |
| `internal/shares/` | Share link CRUD |
| `internal/storage/` | Database open and schema migration |
| `internal/worker/` | Background job orchestration |
| `internal/security/` | RootGuard path validation |
| `internal/config/` | Config parsing and mount discovery |

Safety rules:

- Never bypass `RootGuard` for filesystem operations.
- Never overwrite existing files silently.
- Never use direct rename for cross-mount moves; use copy, verify, then delete.
- New API endpoints belong in `server.go` route registration and focused handler
  files.
- New job types need model and claiming support in the jobs package.

### Frontend

The frontend lives in `frontend/` and uses React, Vite, TypeScript, and CSS
Modules.

```txt
frontend/src/
+-- App.tsx
+-- screens/
+-- pages/
+-- hooks/
+-- components/
|   +-- input/
|   +-- layout/
|   +-- overlay/
|   +-- ui/
+-- utils/
+-- types/
+-- styles/
+-- api/
```

Frontend conventions:

- Use CSS Modules for component styling.
- Use `styles.className` with camelCase class names.
- Keep shared formatting, path, archive, job, view, preview, and wallpaper logic
  in `frontend/src/utils/`.
- Use SVG asset icons for desktop and file-type icons.
- Use UI action icons for toolbar, menu, and command buttons.
- Keep page views as workspace content and transient dialogs as overlays.

## Documentation

The README should stay product-focused: what Volum is, why it exists, how to run
it, and where to find deeper docs.

Contributor setup, architecture notes, verification commands, and codebase
conventions belong in this file.
