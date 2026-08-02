# Volum Desktop

## Build and run

- Production: `docker compose -f docker-compose.server.yml up --build -d`
- Development: `docker compose -f docker-compose.dev.yml up --build`
- Prefer Docker for verification; Go is not installed locally.
- Run frontend lint and type-check after every change, before starting the server.
- Frontend fallbacks: `cd frontend && npm run typecheck`, `npm run lint`, `npm run build`

## Architecture

- Backend: Go, chi, and SQLite under `backend/`.
- Entry point: `backend/cmd/volum/main.go`
- HTTP route registration: `backend/internal/api/server.go`
- File operations: `backend/internal/files/`
- Job persistence: `backend/internal/jobs/`
- Background work: `backend/internal/worker/`
- Path validation: `backend/internal/security/paths.go`
- Frontend: React, Vite, and TypeScript under `frontend/src/`.
- App shell: `frontend/src/App.tsx`
- Workspace state and rendering: `frontend/src/screens/Home.tsx`
- API modules: `frontend/src/api/client-*.ts`
- Pages: `frontend/src/pages/`
- Reusable components: `frontend/src/components/`
- Hooks: `frontend/src/hooks/`
- Shared utilities: `frontend/src/utils/`
- Theme and global styles: `frontend/src/styles/`

## UI conventions

- Workspace navigation uses the `activeView` state from `useNavigation`.
- Page content lives under `frontend/src/pages/`; modal content lives under
  `frontend/src/components/overlay/`.
- Use CSS Modules and camel-case access such as `styles.className`.
- Put shared formatting, path, archive, job, and view helpers in `frontend/src/utils/`.
- Desktop and file-type icons use SVG assets through `IconImg` and
  `frontend/src/api/icons.ts`.
- UI action icons use the shared Lucide-backed `Icon` component.

## Safety

- Validate every filesystem operation through `RootGuard.Resolve`.
- Never silently overwrite existing files.
- Cross-mount moves remain copy, verify, then delete.
- Do not commit `data/`, `storage/`, `frontend/dist/`, or `frontend/node_modules/`.
- Register new API endpoints in `server.go`'s `routes()`.
- New job types require model registration and claiming support.

## Product direction

- Follow `docs/roadmap.md`.
- Keep Volum focused on reliable file management and desktop-style service shortcuts.
- Prefer KISS and YAGNI; do not add monitoring suites, plugin systems, or dashboard
  frameworks without a current product requirement.
