# Architecture & Shell Layout

## Current Layout

The app shell uses a 2-column CSS grid:

```css
/* frontend/src/App.module.css line 1-6 */
.appShell {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: 100vh;
  position: relative;
}
```

```
┌──────────────┬───────────────────────────────────────────┐
│ Sidebar 300px│ Workspace flex:1                          │
│              │                                            │
│ Brand        │ [Desktop | Files | Trash | Settings | Jobs]│
│ Quick Access │                                            │
│ Removable    │                                            │
│ Current Fldr │                                            │
│              │                                            │
└──────────────┴───────────────────────────────────────────┘
```

The sidebar contains mixed-purpose content — app-level items (This PC, Trash, Jobs) mixed with file-navigation items (Favorites, Recent, Removable, Current Folder). This makes the sidebar neither a pure dock nor a pure file navigator.

## Target Layout

The shell becomes a 3-row / 2-column grid:

```css
/* frontend/src/App.module.css — proposed change */
.appShell {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  grid-template-rows: 44px 1fr 28px;
  height: 100vh;
}
```

```
┌──────────────────────────────────────────────────────────┐
│ Top Bar (44px, full width)       grid-area: topbar       │
│ [Volum Desktop]             🕐 12:34  🌙  ⚙             │
├──────┬───────────────────────────────────────────────────┤
│ Dock │ Workspace                   grid-area: dock + main │
│ 56px │                                                    │
│      │  ┌─ Active View ────────────────────────────────┐ │
│ 🏠   │  │ (Desktop / Files / Trash / Settings / Jobs)  │ │
│ 📁   │  │                                                │ │
│ 🗑   │  │                                                │ │
│ ⚙    │  │                                                │ │
│ 📊   │  └──────────────────────────────────────────────┘ │
├──────┴───────────────────────────────────────────────────┤
│ Status Bar (28px, below workspace)  grid-area: statusbar │
│ 14 items (3 selected) · 2.4 GB free · /mnt/data          │
└──────────────────────────────────────────────────────────┘
```

### Grid Area Assignments

```css
.appShell {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  grid-template-rows: 44px 1fr 28px;
  height: 100vh;
  /* grid-template-areas = named approach */
  grid-template-areas:
    "topbar  topbar"
    "dock    main"
    "dock    statusbar";
}

/* Using explicit row/column instead of areas for cleaner code: */
.topbar {
  grid-column: 1 / -1;
  grid-row: 1;
}

.dock {
  grid-column: 1;
  grid-row: 2 / -1;
}

.workspace {
  grid-column: 2;
  grid-row: 2;
}

.statusBar {
  grid-column: 2;
  grid-row: 3;
}
```

## Current CSS to Remove

When the sidebar is replaced by the dock, these CSS classes in `App.module.css` need removal (or move to `FilesSidebar.module.css`):

| Class | Lines | Action |
|-------|-------|--------|
| `.sidebar` | 16-24 | Remove (replaced by dock) |
| `.sidebarHidden .sidebar` | 26-28 | Remove |
| `.sidebarHidden` | 30-32 | Remove |
| `.sidebarToggle` | 145-168 | Remove |
| `.sidebarToggleCollapsed` | 170-172 | Remove |
| `.sidebarToggleOpen` | 174-176 | Remove |
| `.sidebarHeader` | 123-131 | Remove |
| `.navSection` | (all) | Move to FilesSidebar.module.css |
| `.sectionHeader` | 187-201 | Move to FilesSidebar.module.css |
| `.sectionBody` | 213-216 | Move to FilesSidebar.module.css |
| `.sectionCollapsed` | 218-220 | Move to FilesSidebar.module.css |
| `.chevron/chevronCollapsed` | 202-211 | Move to FilesSidebar.module.css |
| `.rootList` | 243-246 | Move to FilesSidebar.module.css |
| `.rootItem` | 248-263 | Move to FilesSidebar.module.css |
| `.rootDetails` | 265-286 | Move to FilesSidebar.module.css |
| `.rootMeter` | 288-301 | Move to FilesSidebar.module.css |
| `.deviceGroup` | 310-313 | Move to FilesSidebar.module.css |
| `.deviceHeader` | 315-324 | Move to FilesSidebar.module.css |
| `.partitionItem` | 327-398 | Move to FilesSidebar.module.css |
| `.partitionUnmounted` | 346-353 | Move to FilesSidebar.module.css |
| `.favDetails` | 480-502 | Move to FilesSidebar.module.css |
| `.favRemove` | 504-520 | Move to FilesSidebar.module.css |
| `.trashBadge` | 400-414 | Move to Dock.module.css (or keep local copy) |
| `.brand` | 92-103 | Move to TopBar.module.css |
| `.brandMark` | 105-110 | Move to TopBar.module.css or shared styles |
| Media queries (.appShell at max-width 1100, 760, 480) | 1453-1557 | Update to new grid layout |

### Classes that stay in App.module.css (unchanged)
- `.appShell` — update grid template
- `.workspace` — update grid row
- `.authShell`, `.loginPanel`, `.loginError`
- `.desktop` — moves to DesktopView.module.css
- `.desktopIcon`, `.desktopIconLabel`, `.desktopIconUsage` — move to DesktopView.module.css
- `.desktopIconWrapper`, `.desktopTrashBadge` — move to DesktopView.module.css
- `.topbar` — remove, now handled by TopBar component CSS
- `.toolbar` — keep (used in file area)
- `.selectionBar`, `.selectionActions, .selectionBar button` — keep
- `.fileList`, `.fileGrid`, `.fileColumns` — keep
- `.fileRow`, `.fileRow.selected`, `.fileName`, `.fileThumb`, `.fileMeta` — keep
- `.columnBrowser`, `.columnPane`, `.columnItem`, `.columnItemName` — keep
- `.breadcrumbs*` — remove (moved to BreadcrumbBar.module.css)
- `.searchBox`, `.searchClear`, `.searchResultsDropdown`, `.searchResultItem` — keep
- `.sortSelect` — keep (or remove when column headers replace dropdown)
- `.rubberBand` — keep
- `.contextMenu` — keep (used by FilesView + DesktopContextMenu)
- `.skeleton*` — keep
- `.trashGrid`, `.trashItemRow`, `.trashItemInfo` — move to TrashView.module.css
- `.trashActionBtn` — move to TrashView.module.css
- `.driveContents`, `.drivePartitionItem`, `.drivePartitionInfo`, `.drivePartitionMeter` — move to DesktopView.module.css
- `.errorBanner`, `.sseWarning`, `.errorDismiss` — keep
- `.emptyState`, `.folderEmptyState`, `.folderEmptyIcon`, `.folderEmptyTitle`, `.folderEmptySubtitle`, `.folderEmptyActions` — keep
- `.shortcutsPanel`, `.shortcutRow`, `.shortcutKey` — keep
- `.settingsPanel`, `.settingsHeader`, `.settingsClose`, `.settingsBody`, `.settingsSection`, `.settingsDetails`, `.settingsRootList`, `.settingsRootItem`, `.settingsRootName` — moves to SettingsPanel.module.css

## View Switching Logic

In `App.tsx`, the workspace content currently switches based on multiple booleans:

```tsx
{showingJobs ? (
  <JobsPage ... />
) : showingSettings ? (
  <SettingsPanel ... />
) : showingTrash ? (
  // trash content
) : !currentPath ? (
  // desktop content
) : loading ? ( ... )
: filteredEntries.length === 0 ? ( ... )
: ( // file grid
```

This should be refactored with a derived `activeView`:

```typescript
const activeView = useMemo(() => {
  if (showingSettings) return 'settings';
  if (showingJobs) return 'jobs';
  if (showingTrash) return 'trash';
  if (currentPath) return 'files';
  return 'desktop';
}, [currentPath, showingTrash, showingSettings, showingJobs]);
```

Then workspace becomes:

```tsx
<section className={styles.workspace}>
  {activeView === 'desktop' && <DesktopView ... />}
  {activeView === 'files' && <FilesView ... />}
  {activeView === 'trash' && <TrashView ... />}
  {activeView === 'settings' && <SettingsView ... />}
  {activeView === 'jobs' && <JobsView ... />}
  <StatusBar visible={activeView !== 'desktop'} ... />
</section>
```

## Media Query Handling

### Current (max-width: 1100px)
```css
.appShell { grid-template-columns: 260px minmax(0, 1fr); }
.sidebarToggle { left: calc(260px - 15px); }
.sidebarHidden { grid-template-columns: 0px minmax(0, 1fr); }
```

### Target (max-width: 1100px)
```css
/* At 1100px, dock stays 56px but TopBar brand becomes smaller */
.appShell { grid-template-columns: 56px minmax(0, 1fr); grid-template-rows: 38px 1fr 24px; }
.topbar { height: 38px; }
.statusBar { height: 24px; font-size: 11px; }
```

### Current (max-width: 760px)
```css
.appShell { grid-template-columns: 1fr; }
.sidebarToggle { display: none; }
.sidebarHidden { grid-template-columns: 1fr; }
.sidebar { display: grid; grid-auto-flow: column; padding: var(--space-md); }
```

### Target (max-width: 760px)
```css
/* At 760px, dock collapses to a bottom bar or becomes a hamburger menu */
.appShell { grid-template-columns: 1fr; grid-template-rows: 38px 1fr 48px 24px; }
.dock { grid-column: 1; grid-row: 3; grid-template-columns: 1fr; flex-direction: row; height: 48px; }
.dock { border-right: 0; border-top: 1px solid var(--color-border-light); }
.workspace { grid-row: 2; }
.statusBar { grid-column: 1; grid-row: 4; }
```

## Key Considerations

1. **The dock must be keyboard-accessible** — each item is a `<button>` with `aria-label`, Tooltip on hover, focus ring visible.
2. **Transition to new layout should be additive** — keep old sidebar code paths working during early phases by wrapping them in conditionals.
3. **Existing handlers stay in App.tsx** — the extracted view components receive handlers as props, keeping all state management in App.tsx during migration.
4. **CSS Modules mean cross-file class reuse won't work** — shared sidebar styles must be duplicated or extracted to a shared CSS file (e.g., `shared.module.css`) used by both `FilesSidebar.module.css` and `App.module.css`.
