# Volum Desktop — GNOME-Style Web Desktop Transformation Plan

This document is the index for the full transformation plan. Each linked document covers one component or phase in detail.

## Overview

Volum Desktop shifts from a "web file manager with sidebar" to a **full GNOME-style desktop environment** running in the browser. The shell becomes a proper desktop GUI with a top bar, dock, status bar, and app-focused views — rather than a single file manager with pages.

## Documents

| # | Document | Description |
|---|----------|-------------|
| 1 | [Architecture & Shell Layout](./desktop-arch.md) | Grid layout, CSS changes, app shell structure |
| 2 | [Top Bar Spec](./desktop-topbar.md) | Design, component API, system menu, clock |
| 3 | [Dock + Files Sidebar Spec](./desktop-dock.md) | 56px dock rail, expandable files navigation panel |
| 4 | [Desktop View + Context Menus](./desktop-desktopview.md) | Volume icons, system icons, right-click menus |
| 5 | [Settings Reorganization Spec](./desktop-settings.md) | Internal sidebar navigation, category sections |
| 6 | [Status Bar Spec](./desktop-statusbar.md) | Item count, free space, path display |
| 7 | [Name Change Inventory](./desktop-rename.md) | All user-facing "Volum" → "Volum Desktop" locations |
| 8 | [Migration Plan](./desktop-migration.md) | Phased execution order, file-by-file changes |

## Key Principles

1. **No theme changes** — current colors, spacing, border-radii stay as-is. Only layout and interaction patterns change.
2. **GNOME fidelity** — layout and behavior match Nautilus/Files + GNOME Shell as closely as is practical for a web app.
3. **Phased execution** — each phase is independently verifiable without breaking existing functionality.
4. **Internal identifiers preserved** — localStorage keys, env vars, cookie names, module paths stay `volum_*` for config compatibility.

## Current Layout (Before)

```
grid-template-columns: 300px minmax(0, 1fr)
grid-template-rows: 1fr

┌──────────────┬───────────────────────────────────────────┐
│ Sidebar 300px│ Workspace flex:1                          │
│              │                                            │
│ Brand        │ [Desktop | Files | Trash | Settings | Jobs]│
│ Quick Access │                                            │
│ Removable    │                                            │
│ Current Fldr │                                            │
└──────────────┴───────────────────────────────────────────┘
```

## Target Layout (After)

```
grid-template-columns: 56px minmax(0, 1fr)
grid-template-rows: 44px 1fr 28px

┌──────────────────────────────────────────────────────────┐
│ Top Bar (44px, full width)                                │
├──────┬───────────────────────────────────────────────────┤
│ Dock │ Workspace                                          │
│ 56px │                                                    │
│      │  ┌─ Desktop / Files / Trash / Settings / Jobs ───┐│
│      │  │ (active app view takes full remaining area)    ││
│      │  └──────────────────────────────────────────────┘│
├──────┴───────────────────────────────────────────────────┤
│ Status Bar (28px, below workspace)                        │
└──────────────────────────────────────────────────────────┘
```

## Component Tree (Target)

```
App
├── TopBar                    ← Always visible, full width
│   ├── Brand                 ← "Volum Desktop", click → desktop
│   ├── AppMenu               ← File/Edit/View/Go (only when Files active)
│   └── SystemMenu            ← Theme, shortcuts, settings, logout
│
├── Dock                      ← Always visible, 56px left column
│   ├── DockItem(Home)        ← Desktop view
│   ├── DockItem(Files)       ← File browser
│   ├── DockItem(Trash)       ← Trash view, badge=count
│   ├── DockItem(Jobs)        ← Jobs view, badge=active count
│   └── DockItem(Settings)    ← Settings view
│
├── Workspace                 ← Content area, switches by active view
│   ├── DesktopView           ← When no app is active
│   │   ├── VolumeIcon[]      ← Mounted partitions
│   │   └── SystemIcon[]      ← Trash, Jobs, Settings, Drives
│   │
│   ├── FilesView             ← When browsing files
│   │   ├── FilesSidebar      ← 240px, collapsible (Places/Devices/Bookmarks)
│   │   ├── FileArea          ← BreadcrumbBar + Toolbar + File grid/list
│   │   └── StatusBar         ← Item count + free space
│   │
│   ├── TrashView             ← When viewing trash
│   │   ├── Toolbar           ← Select, sort, restore, delete
│   │   └── TrashGrid         ← Existing trash item list/grid
│   │
│   ├── SettingsView          ← When viewing settings
│   │   ├── SettingsHeader    ← Title + back + refresh
│   │   ├── SettingsSidebar   ← Category nav (200px)
│   │   └── SettingsContent   ← Selected category content
│   │
│   └── JobsView              ← When viewing jobs
│       ├── JobsPage          ← Existing component
│       └── StatusBar
│
└── Overlays (unchanged)
    ├── PreviewModal / InfoPanel / ShareDialog / ShareManager
    ├── ConfirmDialog / TextInputDialog / TransferDialog
    ├── BatchRenameModal
    └── ToastViewport
```

## State Model (Target)

Replace multiple booleans with a single derived active view:

```typescript
type ActiveView = 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';

// Derived from existing state:
const activeView = useMemo<ActiveView>(() => {
  if (showingSettings) return 'settings';
  if (showingJobs) return 'jobs';
  if (showingTrash) return 'trash';
  if (currentPath) return 'files';
  return 'desktop';
}, [currentPath, showingTrash, showingSettings, showingJobs]);
```

The existing state (`currentPath`, `showingTrash`, `showingSettings`, `showingJobs`) stays — keeping backward compatibility with all existing handler code. Only the rendering logic changes to use `activeView`.

## New Files

```
frontend/src/components/
├── TopBar.tsx                (+ TopBar.module.css)
├── Dock.tsx                  (+ Dock.module.css)
├── DesktopView.tsx           (+ DesktopView.module.css)
├── FilesSidebar.tsx          (+ FilesSidebar.module.css)
├── StatusBar.tsx             (+ StatusBar.module.css)
├── SystemMenu.tsx            (+ SystemMenu.module.css)
├── DesktopContextMenu.tsx    (+ DesktopContextMenu.module.css)
├── FilesView.tsx             (+ FilesView.module.css) — extracted from App.tsx
├── TrashView.tsx             (+ TrashView.module.css) — extracted from App.tsx
└── SettingsView.tsx          — wraps SettingsPanel page variant
```

Refer to each linked document for full specifications.
