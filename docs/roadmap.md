# Volum Roadmap

## Architecture

```
Current: [ Sidebar 300px ] [ Workspace flex:1 ] [ Jobs Drawer 300px ]
Target:  [ Sidebar 300px ] [ Workspace flex:1 (full width) ]
```

**Key problems being solved:**
- Jobs drawer permanently eats 300px — move to desktop icon + page
- Sidebar Storage shows every drive (SATA, NVMe, USB) — too noisy, hide internal drives
- `roots` state is fetched but never displayed — dead data
- 81 UI audit issues (6 critical bugs, missing states, a11y gaps, edge cases, inline styles)

## Batch 1 — Critical Bugs (6 items)

| # | Problem | Fix | File |
|---|---------|-----|------|
| 1.1 | Rubber band selection — `querySelectorAll('.file-row')` bare string won't match CSS Modules hashed class | Use `[data-index]` attribute selector | `App.tsx:1184` |
| 1.2 | Danger buttons use bare `className="danger"` — not CSS Modules hashed, so no red styling | `className={styles.danger}` | `App.tsx:1561,1799` |
| 1.3 | Search result click — `path.lastIndexOf('/')` returns -1 for root-level items (no `/`) | Change `|| 1` to check `lastIndexOf` < 0 | `App.tsx:1688` |
| 1.4 | Trash view toggle only cycles list↔grid — if user was in columns mode, preference is lost | Reset to `list` when entering trash if `columns` | `App.tsx:1377` (trash entry handler) |
| 1.5 | Column view drag-over — `styles.fileColumns.dragOver` CSS rule referenced but doesn't exist | Add `.fileColumns.dragOver` style | `App.module.css` |
| 1.6 | Breadcrumb overflow menu — no Escape or click-outside to dismiss | Add useEffect for keydown + outside-click | `BreadcrumbBar.tsx` |

## Batch 2 — Sidebar Cleanup

Goal: sidebar shows what matters, hides noise.

| # | Change | Detail |
|---|--------|--------|
| 2.1 | Rename "Storage" → "Removable" | Section header label |
| 2.2 | Filter to USB/removable only | `dev.transport === 'usb'` filter in sidebar render |
| 2.3 | Add "Jobs" to sidebar Quick Access | Button below Trash with active count badge |
| 2.4 | Remove unused `roots` state from sidebar rendering | Still fetched for folder picker, but no sidebar dead code |

**Result sidebar:**
```
Quick Access
  ○ This PC
  ● Trash (3)
  ● Jobs (1 active)
  ★ Favorites
  ⌚ Recent

Removable
  USB: SanDisk 128GB
    · /mnt/usb

Current Folder
  · subdir/
  · another/
```

## Batch 3 — Jobs → Desktop Icon + Page

Goal: remove permanent right column, add Jobs as desktop system icon (same pattern as Trash/Settings).

| # | Change | Detail |
|---|--------|--------|
| 3.1 | Remove job drawer from app shell | `grid-template-columns: 300px minmax(0, 1fr)` (remove final 300px) |
| 3.2 | Delete `.jobDrawer` + related CSS | `.jobDrawer`, `.jobFilterTabs`, `.jobFilterTab`, `.jobClearBtn` from `App.module.css` |
| 3.3 | Add `showingJobs` state | Same pattern as `showingTrash`, `showingSettings` |
| 3.4 | Create `JobsPage` component | Full page with BreadcrumbBar, filter tabs, job list, clear buttons |
| 3.5 | Add Jobs desktop icon | Desktop icon with badge count — same pattern as Trash/Settings |
| 3.6 | Wire sidebar Jobs button | Navigate to Jobs page |
| 3.7 | Extract job list rendering | Move job cards from `App.tsx` into `JobsPage.tsx` |

**Result:**
```
[ Sidebar 300px ] [ Workspace flex:1 (FULL WIDTH) ]
```

Desktop has 4 icons: Drives, Trash, Settings, Jobs.

## Batch 4 — Loading & Error States (15 items)

| # | Fix |
|---|-----|
| 4.1 | Column view loading: skeleton cards |
| 4.2 | Jobs page empty: icon + "No jobs yet" layout |
| 4.3 | Settings loading: skeleton card |
| 4.4 | InfoPanel saving: spinner during chmod submit |
| 4.5 | ShareDialog submit: spinner during "Creating..." |
| 4.6 | ShareManager loading: skeleton rows |
| 4.7 | BatchRename submit: spinner during "Renaming..." |
| 4.8 | SSE disconnect: reconnect with backoff + "Connection lost" indicator |
| 4.9 | Error banner: add dismiss button |
| 4.10 | ShareManager error: add "Retry" button |
| 4.11 | FolderPicker error: add "Retry" button |
| 4.12 | Settings error: add "Retry" button |
| 4.13 | Silent `.catch(() => undefined)` on trash/jobs fetch → at least `console.error` |
| 4.14 | Silent `.catch(() => undefined)` on dir sizes polling → at least `console.error` |
| 4.15 | Toast animations: fade-in/fade-out transitions |

## Batch 5 — Edge Cases & Code Cleanup (16 items)

| # | Fix |
|---|-----|
| 5.1 | `part.size` null guard — fallback to `'Unknown'` |
| 5.2 | `entry.size` null guard in `formatBytes` — avoid NaN |
| 5.3 | `dev.name` / `dev.model` fallback — "Unknown device" |
| 5.4 | Extract `formatBytes` + `formatUptime` to `utils/format.ts` |
| 5.5 | Extract duplicated sort-select JSX to `<SortSelect>` |
| 5.6 | Extract duplicated theme toggle to `<ThemeToggle>` |
| 5.7 | Extract duplicated logout button to `<LogoutButton>` |
| 5.8 | Fix `(document as any).__longPressTimer` → `useRef` |
| 5.9 | Rename `.desktopTrashIcon` → `.desktopIconWrapper` (used by both trash and settings) |
| 5.10 | Fix "Share" icon: `edit-download` → `mail-send` |
| 5.11 | Fix "Clear completed" label when failed/cancelled present |
| 5.12 | Fix trash empty `<span>` column — fill or remove |
| 5.13 | Fix `buildColumnPath` unused `roots` parameter |
| 5.14 | Fix desktop drive mounted-count computed twice |
| 5.15 | Fix BreadcrumbBar drive label IIFE — extract to variable |
| 5.16 | Fix `cycleViewMode` nested ternary — extract to function |

## Batch 6 — Accessibility (12 items)

| # | Fix |
|---|-----|
| 6.1 | Context menu: `role="menu"`, `role="menuitem"`, Escape close, arrow-key nav |
| 6.2 | Hidden file input: `visually-hidden` class not `display: none` |
| 6.3 | Section chevrons: `aria-hidden="true"` |
| 6.4 | Brand button: `aria-label="Go to desktop"` |
| 6.5 | Sort select: wrap in `<label>` or add `aria-label` |
| 6.6 | Search results: `aria-label` on result buttons |
| 6.7 | Favorite remove button: keyboard-accessible (Tab, not hover-only) |
| 6.8 | Desktop icons: `aria-label` concatenating label + details |
| 6.9 | Trash items: keyboard navigation (arrow keys, Enter) |
| 6.10 | Jobs page items: keyboard-navigable list |
| 6.11 | Empty states: `role="status"` / `aria-live="polite"` |
| 6.12 | PDF preview: `target="_blank"` + `rel="noopener noreferrer"` |

## Batch 7 — Inline Styles → CSS Modules (11 items)

| # | Fix |
|---|-----|
| 7.1 | Usage meter bars: CSS custom property `--meter-width` |
| 7.2 | Unmounted partition opacity: CSS class not `style={{ opacity }}` |
| 7.3 | Root warning label: CSS class |
| 7.4 | "Manage Shares" marginTop: CSS class |
| 7.5 | Progress bar width: CSS custom property `--progress` |
| 7.6 | `34px` gap in file grid → `var(--space-3xl)` |
| 7.7 | `128px` column width → CSS variable |
| 7.8 | `.rename-input` global → `.renameInput` CSS module |
| 7.9 | Context menu viewport clamping |
| 7.10 | "No jobs yet" → `.emptyState` CSS class |
| 7.11 | Search debounce: 200ms debounce to `handleGlobalSearch` |

## Batch 8 — Future Features (from Phase 3)

| # | Feature |
|---|---------|
| 8.1 | Disk usage analyzer — recursive folder size scanning + tree UI |
| 8.2 | Bookmarks / pinned paths — sidebar section, localStorage |
| 8.3 | Per-folder view preferences — persist view mode/sort per directory |
| 8.4 | Dual-pane view — side-by-side browser for copy/move |

## Execution Order

```
Batch 1 (bugs) → Batch 2 (sidebar) → Batch 3 (jobs) → Batch 4 (states)
→ Batch 5 (edge cases) → Batch 6 (a11y) → Batch 7 (CSS) → Batch 8 (features)
```

Batches 1–3 are structural (bugs, layout, new page). Batches 4–7 are code-level polish. Batch 8 is feature work.

## Completed

- [x] Admin share management UI (ShareManager)
- [x] Settings page (version, DB maintenance, root health, worker status)
- [x] Desktop drive view (physical drives → partition contents)
- [x] Empty folder UI (centered icon + "New Folder" button)
- [x] Scrollbar theming (global, removed per-component overrides)
- [x] Desktop settings icon (SVG from assets, removed from sidebar)
- [x] Quick Share (one-click context menu, copies link to clipboard)
- [x] Multi-arch Docker builds (linux/amd64 + linux/arm64)
- [x] Release checklist (RELEASE.md)
- [x] Screenshot capture script (scripts/capture-screenshots.mjs)
- [x] Quick-start compose file (docker-compose.yml)
- [x] Reverse proxy docs (Nginx + Traefik + Tailscale)
- [x] Awesome-selfhosted PR template
- [x] Smoke test script (scripts/smoke.sh)
- [x] Version endpoint (GET /api/version, public)
- [x] MIT License
- [x] CI workflow (.github/workflows/docker.yml)
