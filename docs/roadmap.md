# Volum Desktop Roadmap

## Architecture

```
grid-template-columns: 56px minmax(0, 1fr)
grid-template-rows: 44px 1fr 28px

┌──────────────────────────────────────────────────┐
│ Top Bar (44px) [Volum Desktop]        🕐12:34 ⚙ │
├────┬─────────────────────────────────────────────┤
│Dock│ Workspace (flex:1)                          │
│56px│                                             │
│    │ DesktopView / FilesView / TrashView          │
│ 🏠 │ SettingsView / JobsPage                     │
│ 📁 │                                             │
│ 🗑  │ ContextMenu / Overlays                     │
│ ⚙  │                                             │
│ 📊 │                                             │
├────┴─────────────────────────────────────────────┤
│ Status Bar (28px) 42 items · 2.4 GB free         │
└──────────────────────────────────────────────────┘
```

## Completed — Desktop Shell Transformation

### Phase 0: Rename + Prep
- [x] User-facing "Volum" → "Volum Desktop" (index.html, App.tsx brand/login, README.md, AGENTS.md)
- [x] Stub components created: TopBar, Dock, DesktopView, FilesSidebar, StatusBar

### Phase 1: Top Bar
- [x] 44px persistent top bar with brand, clock, theme toggle
- [x] System menu: theme toggle, keyboard shortcuts, settings, logout
- [x] Grid layout updated: `grid-template-rows: 44px 1fr`

### Phase 2: Dock + Sidebar Split
- [x] 56px dock rail with 5 items (Desktop/Files/Trash/Jobs/Settings)
- [x] Active indicator, badge counts, keyboard-accessible buttons
- [x] FilesSidebar extracted (Places, Removable, Current Folder)
- [x] Grid: `grid-template-columns: 56px minmax(0, 1fr)`

### Phase 3: Extract Views
- [x] DesktopView — drive icons, trash, settings, jobs desktop icons
- [x] TrashView — trash item list/grid, bulk restore/delete
- [x] FilesView — FilesSidebar + file area (BreadcrumbBar, toolbar, file list/grid/columns)
- [x] `activeView` derived state replaces boolean flags

### Phase 4: Settings Reorganization
- [x] Sidebar nav with 4 categories: Server, Storage, Administration, About
- [x] Filter/search input to find settings
- [x] Keyboard navigation (up/down/enter)

### Phase 5: Status Bar
- [x] 28px footer with item counts, selection info, storage info, current path
- [x] Per-view visibility (hidden for Settings, Jobs)

### Phase 6: Ctrl+L Location Entry
- [x] BreadcrumbBar location mode with input field
- [x] Ctrl+L toggles, Enter navigates, Escape cancels

## Remaining Backlog

### Batch A — Loading & Error States (11 items)

| # | Fix |
|---|-----|
| A.1 | Column view loading: skeleton cards |
| A.2 | Jobs page empty: icon + "No jobs yet" layout |
| A.3 | Settings loading: skeleton card (already has skeleton block — verify consistency) |
| A.4 | InfoPanel saving: spinner during chmod submit |
| A.5 | ShareDialog submit: spinner during "Creating..." |
| A.6 | BatchRename submit: spinner during "Renaming..." |
| A.7 | Error banner: add dismiss button |
| A.8 | ShareManager error: add "Retry" button |
| A.9 | FolderPicker error: add "Retry" button |
| A.10 | Settings error: add "Retry" button |
| A.11 | Desktop error state: add "Retry" when roots/load fails |

### Batch B — Edge Cases & Code Cleanup (16 items)

| # | Fix |
|---|-----|
| B.1 | `part.size` null guard — fallback to `'Unknown'` | ✅ |
| B.2 | `entry.size` null guard in `formatBytes` — avoid NaN | ✅ unified in shared `utils/format.ts` |
| B.3 | `dev.name` / `dev.model` fallback — "Unknown device" | ✅ |
| B.4 | Extract `formatBytes` + `formatUptime` to `utils/format.ts` | ✅ (+ `formatGridDate`, `formatTrashPath`, `formatDeviceUsage`) |
| B.5 | Extract duplicated sort-select JSX to `<SortSelect>` | ✅ |
| B.6 | Extract duplicated theme toggle to `<ThemeToggle>` | ✅ |
| B.7 | Extract duplicated logout button to `<LogoutButton>` | ✅ |
| B.8 | Fix `(document as any).__longPressTimer` → `useRef` | ✅ |
| B.9 | Rename `.desktopTrashIcon` → `.desktopIconWrapper` (used by both trash and settings) | ✅ |
| B.10 | Fix "Share" icon: `edit-download` → `mail-send` | ✅ |
| B.11 | Fix "Clear completed" label when failed/cancelled present | ✅ |
| B.12 | Fix trash empty `<span>` column — fill or remove | ✅ |
| B.13 | Fix `buildColumnPath` unused `roots` parameter | ✅ extracted to `utils/path.ts` |
| B.14 | Fix desktop drive mounted-count computed twice | ✅ |
| B.15 | Fix BreadcrumbBar drive label IIFE — extract to variable | ✅ |
| B.16 | Fix `cycleViewMode` nested ternary — extract to function | ✅ extracted to `utils/view.ts` |

### Batch C — Accessibility (12 items)

| # | Fix |
|---|-----|
| C.1 | Context menu: `role="menu"`, `role="menuitem"`, Escape close, arrow-key nav |
| C.2 | Hidden file input: `visually-hidden` class not `display: none` |
| C.3 | Section chevrons: `aria-hidden="true"` |
| C.4 | Brand button: `aria-label="Go to desktop"` |
| C.5 | Sort select: wrap in `<label>` or add `aria-label` |
| C.6 | Search results: `aria-label` on result buttons |
| C.7 | Favorite remove button: keyboard-accessible (Tab, not hover-only) |
| C.8 | Desktop icons: `aria-label` concatenating label + details |
| C.9 | Trash items: keyboard navigation (arrow keys, Enter) |
| C.10 | Jobs page items: keyboard-navigable list |
| C.11 | Empty states: `role="status"` / `aria-live="polite"` |
| C.12 | PDF preview: `target="_blank"` + `rel="noopener noreferrer"` |

### Batch D — Inline Styles → CSS Modules (11 items)

| # | Fix |
|---|-----|
| D.1 | Usage meter bars: CSS custom property `--meter-width` |
| D.2 | Unmounted partition opacity: CSS class not `style={{ opacity }}` |
| D.3 | Root warning label: CSS class |
| D.4 | "Manage Shares" marginTop: CSS class |
| D.5 | Progress bar width: CSS custom property `--progress` |
| D.6 | `34px` gap in file grid → `var(--space-3xl)` |
| D.7 | `128px` column width → CSS variable |
| D.8 | `.rename-input` global → `.renameInput` CSS module |
| D.9 | Context menu viewport clamping |
| D.10 | "No jobs yet" → `.emptyState` CSS class |
| D.11 | Search debounce: 200ms debounce to `handleGlobalSearch` |

### Batch E — Future Features

| # | Feature | Status |
|---|---------|--------|
| E.1 | Disk usage analyzer — recursive folder size scanning + tree UI | ✅ Done |
| E.2 | Bookmarks / pinned paths — sidebar section in FilesSidebar, localStorage | ✅ Done |
| E.3 | Per-folder view preferences — persist view mode/sort per directory | ✅ Done |
| E.4 | Dual-pane view — side-by-side browser for copy/move | ⬜ |
| E.5 | Desktop wallpaper / background customization | ✅ Done |
| E.6 | App menu bar (File/Edit/View/Go) in TopBar when Files view active | ✅ Done |
| E.7 | Desktop icon arrangement persistence | ⬜ |

## Execution Order

```
Batch A (error states) → Batch B (cleanup) → Batch C (a11y)
→ Batch D (CSS) → Batch E (features)
```

## Tracking

| Batch | Status |
|-------|--------|
| Shell Transformation (Phases 0-6) | ✅ Complete |
| Batch A — Loading & Error States | ✅ 11/11 |
| Batch B — Edge Cases & Cleanup | ✅ 16/16 |
| Batch B.0 — Standard EmptyState Component | ✅ Done |
| Batch C — Accessibility | ✅ 12/12 |
| Batch D — Inline Styles → CSS | ✅ 11/11 |
| Batch E — Future Features | ✅ 5/7 |
