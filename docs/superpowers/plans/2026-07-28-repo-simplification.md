# Repository Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every unused or duplicated repository, backend, and frontend element named in the approved Ponytail audit without changing Volum's supported workflows.

**Architecture:** Execute deletion-first in four independently reviewable tasks: repository delivery artifacts, backend dormant systems, frontend dead modules, then frontend state consolidation. Existing domain APIs and `ActiveView` are the replacement boundaries; no new framework or compatibility layer is introduced.

**Tech Stack:** Go 1.23, SQLite, React 19, TypeScript 5.7, Vite 6, Vitest, CSS Modules, Docker Compose.

## Global Constraints

- Preserve every current file-management, storage-analysis, job, authentication, sharing, and service-health workflow.
- Keep `RootGuard`, authentication, conflict handling, transactions, and cross-mount copy/verify/delete safety intact.
- Do not migrate or delete user data and do not create or mutate remote GitHub issues.
- Add no new runtime dependency or speculative abstraction.
- Prefix every shell command with `rtk`.
- Run frontend and backend verification through Docker.
- Run frontend lint and type-check after code changes before restarting the server.

---

### Task 1: Repository and Delivery Cleanup

**Files:**
- Delete: `docs/icon-reference/`
- Delete: `docs/DISK_ANALYZER_DUPLICATE_FINDER_PLAN.md`
- Delete: `RELEASE.md`
- Delete: `.github/good-first-issues/`
- Delete: `.github/awesome-selfhosted-pr-template.md`
- Delete: `scripts/visual-audit.mjs`
- Delete: `docker-compose.yml`
- Modify: `.github/CODEOWNERS`
- Modify: `.github/workflows/release.yml`
- Modify: `Makefile`
- Modify: `scripts/README.md`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/styles/tokens.css`
- Delete: `frontend/src/assets/computer.svg`
- Delete: `frontend/src/assets/go-home.svg`

**Interfaces:**
- Consumes: the root `Dockerfile`, `docker-compose.dev.yml`, and `docker-compose.server.yml`.
- Produces: a GitHub Container Registry-only release workflow and `make build` backed by `docker build .`.

- [ ] **Step 1: Establish the configuration baseline**

```bash
rtk docker compose -f docker-compose.dev.yml config
rtk docker compose -f docker-compose.server.yml config
```

Expected: both configurations parse successfully.

- [ ] **Step 2: Delete the audited repository artifacts**

Use `apply_patch` for individual files and a validated, explicit deletion of
`docs/icon-reference/`; do not remove `frontend/public/volum_logo_full.png`.

- [ ] **Step 3: Simplify registry, ownership, and build configuration**

Keep only:

```text
* @shirishkoirala
```

in `CODEOWNERS`; remove Docker Hub login and image output from the release
workflow; change the generic Make build command to:

```make
docker build -t volum .
```

- [ ] **Step 4: Remove the unused monospace font dependency**

Delete the package and import, set `--font-mono` to the existing system
monospace fallback, and regenerate the lockfile in Docker:

```bash
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm install --package-lock-only --ignore-scripts
```

- [ ] **Step 5: Verify repository configuration**

```bash
rtk docker compose -f docker-compose.dev.yml config
rtk docker compose -f docker-compose.server.yml config
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run typecheck
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run lint
```

Expected: all four commands exit zero.

- [ ] **Step 6: Commit**

```bash
rtk git add .github Makefile scripts docs RELEASE.md docker-compose.yml frontend
rtk git commit -m "chore: remove repository and release bloat"
```

### Task 2: Backend Dormant-System Removal

**Files:**
- Delete: `backend/internal/files/cache.go`
- Delete or update: `backend/internal/files/cache_test.go`
- Modify: `backend/cmd/volum/main.go`
- Modify: `backend/internal/files/service.go`
- Modify: `backend/internal/files/service_test.go`
- Modify: `backend/internal/jobs/store.go`
- Modify: `backend/internal/jobs/store_audit.go`
- Modify: `backend/internal/jobs/store_maintenance.go`
- Modify: `backend/internal/jobs/store_claiming.go`
- Modify: `backend/internal/jobs/store_test.go`
- Modify: `backend/internal/storage/sqlite.go`
- Modify: `backend/internal/storage/sqlite_test.go`
- Modify: `backend/internal/api/server.go`
- Modify: `backend/internal/api/handlers_auth.go`
- Modify: `backend/internal/api/handlers_users.go`
- Modify: `backend/internal/api/handlers_db.go`
- Modify: `backend/internal/api/handlers_jobs.go`
- Modify: `backend/internal/api/server_test.go`
- Modify: `backend/internal/worker/worker.go`
- Modify: `backend/internal/worker/worker_analysis.go`
- Modify: `backend/internal/worker/checksum.go`
- Modify: `backend/internal/worker/tar.go`
- Modify: `backend/internal/worker/worker_test.go`
- Modify: `backend/internal/config/config.go`
- Modify: `backend/internal/config/config_test.go`
- Modify: `backend/internal/auth/store.go`

**Interfaces:**
- Consumes: `files.immediateDirSize`, `api.decodeJSONBody`, worker `hashFile`/`hashReader`, `jobs.Store` claim methods, and `sqlutil.Scanner`.
- Produces: `files.NewService(guard)` with no cache argument, unscheduled FIFO claim queries, and behavior-equivalent worker dispatch.

- [ ] **Step 1: Create the compile-failure checkpoint**

Delete the cache, audit-log, scheduling, and test-only wrapper declarations
first, then run:

```bash
rtk docker build --target backend-base -t volum-backend-red .
```

Expected: compilation or tests fail at remaining callers of the removed APIs.

- [ ] **Step 2: Rewire production callers minimally**

Update constructors to `files.NewService(guard)`, call `immediateDirSize`
directly, remove all audit writes and prune-audit routes, and remove
`scheduled_at` from new schema/index/claim SQL. Existing SQLite databases may
retain their old column.

- [ ] **Step 3: Collapse exact duplicate implementations**

Use `decodeJSONBody` only for login, setup, create-user, and change-password.
Use `hashFile(path, "sha256")` and `hashReader` for existing SHA-256 work.
Use a small worker helper only for transfer, checksum, analyze, and duplicate
claim/run branches while preserving their current priority.

- [ ] **Step 4: Update behavior tests**

Adapt tests to `ListPage`, `TrashWithID`, `RestoreTrashRetry`, and
`RootEntries`; delete tests whose only subject was the removed cache,
archive-name helper, audit store, or scheduler. Do not add source-text
assertions for deleted symbols.

- [ ] **Step 5: Verify backend**

```bash
rtk docker build --target backend-base -t volum-backend-check .
```

Expected: golangci-lint reports zero issues, `go vet ./...` exits zero, and all
Go tests pass.

- [ ] **Step 6: Commit**

```bash
rtk git add backend
rtk git commit -m "refactor: remove dormant backend systems"
```

### Task 3: Frontend Dead-Code and API Cleanup

**Files:**
- Delete: `frontend/src/api/client.ts`
- Modify: every TypeScript consumer returned by `rtk rg -l "api/client" frontend/src`
- Delete: `frontend/src/components/layout/TopBarQuickActions.tsx`
- Delete: `frontend/src/components/layout/TopBarQuickActions.module.css`
- Modify: `frontend/src/components/input/FolderPicker.tsx`
- Modify: `frontend/src/components/input/FolderPicker.module.css`
- Modify: `frontend/src/test/Dialogs.test.tsx`
- Modify: `frontend/src/components/layout/AppPanel.tsx`
- Modify: `frontend/src/components/layout/AppPanel.module.css`
- Modify: every `AppPanel` call returned by `rtk rg -l "<AppPanel" frontend/src`
- Modify: `frontend/src/hooks/useFavorites.ts`
- Modify: `frontend/src/screens/Home.tsx`
- Modify: `frontend/src/api/baseUrl.ts`
- Modify: `frontend/src/test/upload.test.ts`
- Modify: `frontend/src/utils/services.ts`
- Modify: audited CSS modules under `frontend/src/screens`, `frontend/src/pages`, and `frontend/src/components`

**Interfaces:**
- Consumes: `client-auth`, `client-files`, `client-jobs`, `client-shares`, `client-services`, and `client-base`.
- Produces: direct domain-module imports, layout-free `AppPanel`, and a `useFavorites` result containing only `favorites`, `addFavorite`, and `removeFavorite`.

- [ ] **Step 1: Create the import/interface failure checkpoint**

Delete the API barrel, quick-actions component, and obsolete exports; update
the `useFavorites` and `AppPanel` public shapes before their callers:

```bash
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run typecheck
```

Expected: TypeScript fails at stale imports and props.

- [ ] **Step 2: Repair imports from existing domain modules**

Route auth APIs to `client-auth`, file APIs to `client-files`, job APIs to
`client-jobs`, share APIs to `client-shares`, service APIs to
`client-services`, and `shareUrl`/base helpers to `client-base`. Do not create
another barrel.

- [ ] **Step 3: Remove dead UI and styles**

Delete `FolderSuggestions` and its tests/styles, remove `AppPanel.layout`,
trim `useFavorites`, remove `assetUrl` and `ServiceHealthStatus`, and delete
the exact orphan selectors and tokens identified by the audit.

- [ ] **Step 4: Verify frontend**

```bash
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run typecheck
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run lint
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run test:ci
```

Expected: type-check and lint exit zero; all Vitest files pass.

- [ ] **Step 5: Commit**

```bash
rtk git add frontend
rtk git commit -m "refactor: delete unused frontend layers"
```

### Task 4: Frontend Navigation and Command Simplification

**Files:**
- Modify: `frontend/src/hooks/useNavigation.ts`
- Modify: `frontend/src/hooks/useWorkspaceOpeners.ts`
- Modify: `frontend/src/hooks/useDesktopActions.ts`
- Modify: `frontend/src/hooks/useNavStack.ts`
- Modify: `frontend/src/hooks/useDesktopIcons.tsx`
- Modify: `frontend/src/hooks/useUploadCommands.ts`
- Modify: `frontend/src/hooks/useFileCommands.ts`
- Modify: `frontend/src/hooks/useClickOutsideMenus.ts`
- Modify: `frontend/src/pages/FilesView.tsx`
- Modify: `frontend/src/screens/Home.tsx`
- Modify: `frontend/src/test/useClickOutsideMenus.test.tsx`
- Create or modify: `frontend/src/test/useNavigation.test.tsx`

**Interfaces:**
- Consumes: the existing `ActiveView` union and `filesViewRef` command boundary.
- Produces: one `activeView` state/setter, one outside-menu close callback, and no pending-upload counter or duplicate Home command stack.

- [ ] **Step 1: Write failing hook tests**

Update `useClickOutsideMenus` tests to call:

```ts
useClickOutsideMenus(closeMenus)
```

and verify click plus resize each invoke the callback. Add a navigation test
that opens trash, settings, jobs, drives, search, and analyzer in turn and
asserts the single active view equals the last action.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run test -- src/test/useClickOutsideMenus.test.tsx src/test/useNavigation.test.tsx
```

Expected: tests fail because the old signatures/state shape are still present.

- [ ] **Step 3: Implement the smallest state consolidation**

Replace the six `showing*` booleans with `activeView`, update openers and
navigation stack to set one view, keep search query and selected drive as data,
and remove repeated reset fan-out.

- [ ] **Step 4: Delete dead command and transfer plumbing**

Remove Home's duplicate `useFileCommands` instance and unattached rename ref,
remove pending-upload setters/counts end to end, and make click/resize share one
menu-closing callback.

- [ ] **Step 5: Run focused and full frontend checks**

```bash
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run test -- src/test/useClickOutsideMenus.test.tsx src/test/useNavigation.test.tsx
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run typecheck
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run lint
rtk docker compose -f docker-compose.dev.yml exec -T frontend npm run test:ci
```

Expected: all commands exit zero.

- [ ] **Step 6: Commit**

```bash
rtk git add frontend
rtk git commit -m "refactor: consolidate frontend navigation state"
```

### Task 5: Integrated Verification

**Files:**
- Modify only if verification exposes an issue in a file already in Tasks 1–4.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a production image and a running Docker development stack.

- [ ] **Step 1: Check formatting and repository integrity**

```bash
rtk git diff --check origin/dev...HEAD
rtk rg -n "api/client|scheduled_at|PruneAudit|TopBarQuickActions|pendingUploadCount|layout=\"(stack|split)\"" backend frontend
```

Expected: diff check exits zero and the stale-symbol search returns no matches.

- [ ] **Step 2: Run the full production build**

```bash
rtk docker compose -f docker-compose.server.yml build
```

Expected: frontend formatting/tests/build, backend lint/vet/tests/build, and
final image creation all exit zero.

- [ ] **Step 3: Restart the development stack**

```bash
rtk docker compose -f docker-compose.dev.yml up --build -d
rtk docker compose -f docker-compose.dev.yml ps
```

Expected: `api` and `frontend` report running.

- [ ] **Step 4: Browser smoke test**

Open `http://localhost:8342/` and verify desktop, files, drives, trash,
settings, jobs, search, and storage analyzer render and navigate without a
console-visible failure.

- [ ] **Step 5: Final review**

Review the complete branch diff against
`docs/superpowers/specs/2026-07-28-repo-simplification-design.md`, fixing any
remaining Critical or Important finding before handoff.
