# Over-Engineering Audit

Ranked findings from biggest cut to smallest.

**shrink** Merge `FileGridView.tsx` + `FileListView.tsx` + `FileEntriesView.tsx` (424 lines, ~90% identical — same `useIncrementalEntries`, same memoized sets, same click handler, same layout effects, same props). One component with `viewMode` prop. [frontend/src/components/ui/FileGridView.tsx, FileListView.tsx, FileEntriesView.tsx]

**delete** `FilesViewOverlays.tsx` (285 lines). Massive prop-drilling sink, used by exactly one caller (`FilesView.tsx`). Inline the conditional JSX directly. [frontend/src/components/overlay/FilesViewOverlays.tsx]

**delete** `handlers_upload_app.go` (226 lines). Speculative macOS `.app` bundle auto-extraction on upload — parallel archive pipeline to the worker, no user asked for it. [backend/internal/api/handlers_upload_app.go]

**delete** 9 hook files (~400 lines) that are just `Home.tsx` helper functions: `useContextMenus` (60), `useNavStack` (76), `useViewPreferences` (76), `useDialogStack` (27), `useFileActions` (37), `useToasts` (33), `useClickOutsideMenus` (35), `useNotificationPreferences` (17), `usePreviewNavigation` (37). Each exposes `useState` + `useCallback` — declare state directly in Home.tsx. [frontend/src/hooks/]

**delete** `docs/testing.md` (132 lines), `docs/configuration.md` (113), `docs/reverse-proxy.md` (102), `docs/glossary.md` (95), `docs/release.md` (68), `docs/coverage-baseline.md` (44), `docs/adr/README.md` (12), `docs/change-guides/README.md` (11) — 577 lines of prose that belong as README sections or CONTRIBUTING appendices. [docs/]

**shrink** Consolidate 3 change-guide files (279 lines) into one shorter `docs/changing-volum.md` (~140 saved). [docs/change-guides/]

**delete** `ShellContext.tsx` (24) + `WindowCommands.ts` (44) + `WindowManager.tsx` (~60) — hand-rolled command-registry dispatcher (`registerCommands`/`commandsMap`) that duplicates `useImperativeHandle` on `FilesViewHandle`. [frontend/src/contexts/, frontend/src/components/overlay/WindowManager.tsx]

**delete** `lastUser.ts` (74 lines). Canvas-based avatar fetch, resize to 128px, cache as data URL — just to show "last logged in" profile picture. The username alone suffices. [frontend/src/utils/lastUser.ts]

**delete** Unused window-snapping code in `window.ts` (~80 lines): `getSnapRect`, `getSnapTarget`, `getWorkArea`, `SnapTarget`, `WindowRect`, `WindowSnapConfig`. Only `STANDARD_WINDOW_W/H`/`TOPBAR_H`/`TASKBAR_H` are actually consumed. [frontend/src/utils/window.ts]

**delete** Dead CSS in `global.css` (~70 lines): `.glassControl`, `.glassMenu`, `.glassHover`, `.glassSelected`, `.isUnfocused`, `.appSurfaceControl.isSelected`, `.rowWrap`, `.flex1`, `.grow`, `.shrink0`, `.justifyCenter/Between/End`, `.alignStart/End/Stretch`, `.textMuted`, `.textSecondary`, `.gap2xl/3xl`. Zero references. [frontend/src/styles/global.css]

**shrink** Three throttle implementations (`progressThrottle`, `statusThrottle`, `uploadProgressThrottle`) instead of one generic type with configurable thresholds. ~80 lines saved. [backend/internal/worker/transfer.go, backend/internal/api/upload_multipart.go]

**delete** `ThumbnailPath` method on `files.Service` (18 lines). Defined, never called by any handler or route. [backend/internal/files/service.go:380]

**delete** `DirSizeCache.GetMap` and `DirSizeCache.PurgeExpired` (~30 lines). Only called from tests. [backend/internal/files/cache.go]

**delete** `NewRootGuard(roots)` (paths.go:35-41) — only called from tests. Production uses `NewRootGuardWithRoots`. [backend/internal/security/paths.go]

**delete** `Service.List(path, showHidden)` (service.go:104-110) — 3-line wrapper around `ListPage` only called from tests. [backend/internal/files/service.go]

**shrink** `now() time.Time { return time.Now().UTC() }` duplicated across 6 files. Pull into `internal/timeutil`. [shares/service.go, jobs/store.go, files/service_trash.go, auth/store.go, desktop/store.go, api/handlers_shares.go]

**delete** `.env.development.example` (47 lines) — superset by `.env.server.example`. One `.env.example` with section headers. [.env.development.example]

**delete** `scripts/build-multiarch.sh` (23 lines) — single `docker buildx build` command inside a script. [scripts/build-multiarch.sh]

**delete** Unused Icon mappings: `'view-list-column': Columns3` (columns view was removed), `'pan-down': ChevronDown`. [frontend/src/components/ui/Icon.tsx]

**delete** `itemScanner` interface in `store_items.go:35` — exact copy of `sqlutil.Scanner` in `sqlutil/sqlutil.go:5`. [backend/internal/jobs/store_items.go]

**stdlib** `cx(...classes)` in `shared.tsx:5` — hand-rolled `filter(Boolean).join(' ')` classnames helper. Inline at 7 call sites. [frontend/src/components/ui/shared.tsx]

**stdlib** `parseBool` in `config/config.go:150` — hand-rolled `"1"/"true"/"yes"/"on"` parser. `strconv.ParseBool` covers all standard bool strings. [backend/internal/config/config.go]

**shrink** 4 `ClaimNext*` one-liner wrappers (`ClaimNextTransferJob`, etc.) — export `ClaimNext(types ...JobType)` directly. [backend/internal/jobs/store_claiming.go]

**delete** Unused exports: `reorderFavorites` in `client.ts`, `homeIconUrl()` and `computerIconUrl()` in `icons.ts`, `getStandardWindowPos()` in `window.ts`, `MenuCapabilities` type in `types/capabilities.ts`, `ClipboardState`/`RunAction` in `hooks/types.ts`. Collectively ~50 lines of dead exports. [api/ & utils/ & types/ & hooks/]

**yagni** `utils/brand.ts` — single export `BRAND_ICON_URL = '/volum_logo.svg'`. Inline at 3 call sites. [frontend/src/utils/brand.ts]

**yagni** `utils/view.ts` — single export `type ViewMode = 'list' | 'grid'`. Move to `types/index.ts`. [frontend/src/utils/view.ts]

**yagni** `ValidateHealthURLScheme` in `ssrf.go:28` — redundant with `ValidateHealthURL` which does everything plus DNS resolution. [backend/internal/desktop/ssrf.go]

**yagni** `nullOrString` in `shares/service.go:253` duplicates `optional` in `jobs/store.go:432`. Same `"" → nil` helper. [backend/internal/shares/service.go]

**shrink** `Handler()` method on `Server` (`server.go:95-97`) — 3-line getter. Inline at single call site in `main.go:113`. [backend/internal/api/server.go]

**shrink** `requestVoid` in `client-base.ts:33` — wraps `request<T>` and discards the return. Replace `requestVoid(...)` with `void request(...)` at 12 call sites. [frontend/src/api/client-base.ts]

**shrink** `registerCommands` deep-comparison guard in `Home.tsx` (~20 lines of speculative optimization). Replace with unconditional overwrite. [frontend/src/screens/Home.tsx]

**shrink** `useEscapeStack` module-level singleton state (broken for concurrent mounts). Direct `keydown` listener in the single consumer. [frontend/src/hooks/useEscapeStack.ts]

**native** `Skeleton.tsx` (23 lines, 4 variants) — only ever called with `variant="card"` (12×) and `variant="row"` (2×). Inline CSS animation div. [frontend/src/components/ui/Skeleton.tsx]

**yagni** Duplicate `.danger` class in `shared.module.css` (line 206) — conflicts with `.danger` at line 103. [frontend/src/components/ui/shared.module.css]

---

**net: -~2800 lines, -2 files (handlers_upload_app.go, .env.development.example), -8 doc files, -9 hook files, -4 unused exports, -5 dead methods, -3 throttle types → 1, -4 claim wrappers → 1, -2 duplicate interfaces, -6 duplicate `now()` definitions. Zero deps removable (all npm/Go deps are used).**
