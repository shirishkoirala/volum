# UI Consistency Roadmap

This roadmap tracks UI inconsistencies found in the current frontend after the component reorganization and recent density fixes. Scope is frontend-only unless noted.

## Phase 1 — Clear Visual Bugs

| # | Task | Status |
|---|---|---|
| 1.1 | Align Trash grid behavior with Files grid: fixed compact columns, no stretched selected tile, same icon sizing | ✓ |
| 1.2 | Audit Desktop drive partition cards so mounted root volumes do not appear disabled when they map to `/` | ☐ |
| 1.3 | Fix unsupported action icons by adding explicit mappings before they fall back to `Square` | ☐ |
| 1.4 | Verify all empty/loading/error states use `EmptyState`, `Notice`, or a shared skeleton pattern | ☐ |

## Phase 2 — Shared File/Trash Item System

| # | Task | Status |
|---|---|---|
| 2.1 | Replace TrashView's local `.fileGrid`, `.fileRow`, `.fileName`, and `.fileMeta` styling with the shared `FileGridView`/`FileItem` pattern or a dedicated shared `GridItem` primitive | ☐ |
| 2.2 | Make Files and Trash selection/focus states visually identical, including hover border, selected border, keyboard outline, and text color | ☐ |
| 2.3 | Use one icon size source for grid tiles instead of hardcoded `76`/`84` values across `FileItem` and `TrashView` | ☐ |
| 2.4 | Confirm list, grid, and columns views have matching drag-over and focus-visible behavior | ☐ |

## Phase 3 — CSS Modules Discipline

| # | Task | Status |
|---|---|---|
| 3.1 | Remove global utility classes from component markup where CSS Modules already own layout (`row`, `gapSm`, `truncate`, `justifyBetween`, etc.) | ☐ |
| 3.2 | Replace remaining non-essential inline styles with CSS-module classes or CSS custom properties | ☐ |
| 3.3 | Keep legitimate dynamic CSS variables inline only when the value is data-driven, such as progress width, pointer position, z-index, or wallpaper preview color | ☐ |
| 3.4 | Remove `:global(.dialog-button)` compatibility styling from `FolderPicker.module.css` after all dialog buttons use shared `Button` or module classes | ☐ |

## Phase 4 — Dialog And Overlay Consistency

| # | Task | Status |
|---|---|---|
| 4.1 | Standardize modal shells on `Overlay` + `PanelHeader` + shared action buttons | ☐ |
| 4.2 | Replace `window.confirm()` in Share Manager with the app's `ConfirmDialog` flow | ☐ |
| 4.3 | Make close buttons use `IconButton` + `Icon name="window-close"` instead of hand-written SVGs | ☐ |
| 4.4 | Normalize dialog widths, padding, shadows, and mobile behavior across Preview, InfoPanel, DiskUsageAnalyzer, ShareDialog, ShareManager, BatchRename, and TransferDialog | ☐ |

## Phase 5 — Navigation, Menus, And Actions

| # | Task | Status |
|---|---|---|
| 5.1 | Ensure disabled write actions communicate why they are unavailable: readonly role, no selection, root item, or trash context | ✓ |
| 5.2 | Make File menu, context menu, toolbar, and keyboard shortcut availability use one shared capability model | ✓ |
| 5.3 | Add missing capability guards to AppMenuBar actions so Delete/Rename are disabled when no item is selected, not only when `canWrite=false` | ✓ |
| 5.4 | Normalize menu item heights, icon sizes, separator spacing, and danger action placement between app menu and context menus | ✓ |

## Phase 6 — Settings And Admin Surfaces

| # | Task | Status |
|---|---|---|
| 6.1 | Replace Settings root usage inline meter width with `ProgressBar` or a shared meter primitive | ✓ |
| 6.2 | Ensure Settings, ServerInfo, ShareManager, Jobs, and DiskUsageAnalyzer use the same status badge and notice language | ✓ |
| 6.3 | Normalize settings category nav with the main sidebar/dock density and active-state treatment | ✓ |
| 6.4 | Confirm all admin actions have loading, success, error, and retry states with consistent button sizing | ✓ |

## Phase 7 — Theme And Token Audit

| # | Task | Status |
|---|---|---|
| 7.1 | Audit all CSS variables against `tokens.css`; remove stale references and define only reusable missing tokens | ✓ |
| 7.2 | Keep card radius at `--radius-md` or smaller for repeated operational items unless a modal/shell requires larger radius | ✓ |
| 7.3 | Reduce one-off hardcoded spacing where it should be a design token, while preserving precise layout values for fixed grids | ✓ |
| 7.4 | Verify light/dark contrast for selected items, disabled text, warning/danger notices, progress bars, and skeletons | ✓ |

## Phase 8 — Responsive QA

| # | Task | Status |
|---|---|---|
| 8.1 | Test desktop width similar to the server screenshot: Desktop, Files, Trash, Settings, Jobs, Share Manager | ✓ |
| 8.2 | Test mobile/narrow width for toolbar overflow, breadcrumb wrapping, settings nav, and dialog body scroll | ✓ |
| 8.3 | Verify text does not overflow buttons, cards, breadcrumbs, menu items, and grid tiles with long file names | ✓ |
| 8.4 | Add visual regression notes/screenshots for any high-risk layout after each phase | ✓ |

## Acceptance Checks

- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run build`
- Manual QA in dark and light themes for Desktop, Files, Trash, Jobs, Settings, Share dialog/manager, Info panel, Preview modal, Batch Rename, Folder Picker, and Disk Usage Analyzer.
- No backend or API behavior changes unless a UI bug depends on incorrect device/root metadata.
