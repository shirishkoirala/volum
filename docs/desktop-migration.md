# Phased Migration Plan

## Overview

The Volum Desktop transformation is divided into 6 phases, designed to ship incrementally. Each phase produces a working state that can be tested and deployed before moving to the next.

```
Phase 0: Rename + Prep          (1-2 sessions)
Phase 1: Top Bar                (2-3 sessions)
Phase 2: Dock + Sidebar Split   (3-4 sessions)
Phase 3: Extract Views          (2-3 sessions)
Phase 4: Settings Reorg         (1-2 sessions)
Phase 5: Context Menus          (1-2 sessions)
Phase 6: Nautilus UX Polish     (2-3 sessions)
```

Total estimated: 12-19 sessions of ~30 min each, or 1-2 intensive days.

---

## Phase 0: Rename + Prep

### Tasks
1. Rename user-facing "Volum" → "Volum Desktop" per [desktop-rename.md](./desktop-rename.md)
2. Create stub components with placeholder render:
   - `frontend/src/components/TopBar.tsx` (just renders "TopBar")
   - `frontend/src/components/Dock.tsx` (just renders "Dock")
   - `frontend/src/components/DesktopView.tsx` (just renders "DesktopView")
   - `frontend/src/components/FilesSidebar.tsx` (just renders "FilesSidebar")
   - `frontend/src/components/StatusBar.tsx` (just renders "StatusBar")
3. Create corresponding CSS module files (empty or minimal)
4. Add these to the project structure with empty exports

### Files Created
- `frontend/src/components/TopBar.tsx` + `.module.css`
- `frontend/src/components/Dock.tsx` + `.module.css`
- `frontend/src/components/DesktopView.tsx` + `.module.css`
- `frontend/src/components/FilesSidebar.tsx` + `.module.css`
- `frontend/src/components/StatusBar.tsx` + `.module.css`

### Verification
- App still loads and works exactly as before
- No regressions in file listing, navigation, trash, settings, jobs
- `npx tsc --noEmit` passes

---

## Phase 1: Top Bar

### Tasks
1. Implement full `TopBar.tsx` component (brand, clock, theme toggle, system menu dropdown)
2. Implement `SystemMenu.tsx` (dropdown with theme toggle, keyboard shortcuts, logout)
3. Add `TopBar` to `App.tsx` shell, above the current sidebar
4. Add `grid-template-rows: 44px 1fr` to `.appShell` CSS
5. Remove existing inline brand from sidebar header
6. Add clock state with `setInterval` (30s update)

### JSX Changes in App.tsx
```tsx
<main className={styles.appShell}>
  <TopBar
    activeView={activeView}
    onGoDesktop={() => { setCurrentPath(''); setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); setSelectedDriveName(null); }}
    theme={theme}
    onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    onOpenSettings={() => setShowingSettings(true)}
    onLogout={handleLogout}
    onOpenShortcuts={() => setShortcutsOpen(true)}
    session={session}
  />
  <aside className={styles.sidebar}>  {/* unchanged for now, will be split in Phase 2 */}
    ...
  </aside>
  <section className={styles.workspace}>  {/* unchanged */}
    ...
  </section>
</main>
```

### CSS Changes in App.module.css
```css
.appShell {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  grid-template-rows: 44px 1fr;
  height: 100vh;
}
```

### Verification
- Top bar shows at top of window
- Brand, clock, theme toggle, system menu all functional
- Sidebar grid row position may need adjusting
- Existing functionality unchanged

---

## Phase 2: Dock + Sidebar Split

### Tasks
1. Implement `Dock.tsx` with 5 items (Desktop, Files, Trash, Jobs, Settings) + active indicator
2. Implement `FilesSidebar.tsx` by extracting file-navigation sections from `App.tsx` sidebar
3. Replace `<aside className={styles.sidebar}>` in `App.tsx` with `<Dock />` + conditional `<FilesSidebar />`
4. Extract sidebar CSS from `App.module.css` → `FilesSidebar.module.css`
5. Create `FilesView.tsx` container that wraps FilesSidebar + current file area content
6. Wire dock item clicks to existing state setters

### New Layout in App.tsx
```tsx
<main className={styles.appShell}>
  <TopBar ... />
  <Dock items={dockItems} onActivate={handleDockActivate} />
  <section className={styles.workspace}>
    {activeView === 'desktop' && <DesktopView ... />}
    {activeView === 'files' && <FilesView ... />}
    {activeView === 'trash' && <TrashContent ... />}
    {activeView === 'settings' && <SettingsPanel ... />}
    {activeView === 'jobs' && <JobsPage ... />}
  </section>
</main>
```

### CSS Changes
```css
.appShell {
  grid-template-columns: 56px minmax(0, 1fr);
  grid-template-rows: 44px 1fr 28px;
}

.dock {
  grid-column: 1;
  grid-row: 2 / -1;
}

.workspace {
  grid-column: 2;
  grid-row: 2;
}
```

### Deduplication Strategy for Sidebar CSS

The old sidebar CSS in `App.module.css` is extensive. Rather than prematurely splitting it, use an `:export` approach or duplicate the needed classes in `FilesSidebar.module.css`. Since CSS Modules scopes classes by file, duplication is acceptable — the two files won't collide.

**Approach**: Copy the relevant CSS blocks (~200 lines) from `App.module.css` into `FilesSidebar.module.css`. Mark the App.module.css copies as `/* REMOVE AFTER PHASE 2 */` for later cleanup.

### Verification
- Dock renders on the left with clickable items
- Clicking dock items switches workspace content
- Files view has a collapsible files sidebar
- All file navigation still works
- Trash, Settings, Jobs still accessible
- `npx tsc --noEmit` passes

---

## Phase 3: Extract Views

### Tasks
1. Create `DesktopView.tsx` — move desktop rendering code from App.tsx
2. Create `TrashView.tsx` — move trash rendering code from App.tsx
3. Create `JobsView.tsx` — wrap existing JobsPage component or extract
4. Extract context menu logic into reusable `ContextMenu.tsx` component

### DesktopView Extraction

Move from App.tsx to DesktopView.tsx:
- `.desktop` section + all desktop icons JSX (~60 lines)
- `.driveContents` section (~40 lines)
- Desktop event handlers (navigate to root, trash, drive)
- Desktop context menu handler
- Related state: `selectedDriveName`, `driveContents`
- Related CSS: `.desktop`, `.desktopIcon*`, `.driveContents*`, `.desktopIconWrapper`, `.desktopTrashBadge`

### TrashView Extraction

Move from App.tsx to TrashView.tsx:
- Trash rendering JSX (around lines 470-520, above the `.desktop` section)
- Empty trash handler
- Restore from trash handler
- Related CSS: `.trashGrid`, `.trashItemRow`, `.trashItemInfo`, `.trashActionBtn`

### ContextMenu Extraction

Move from inline code in App.tsx to `ContextMenu.tsx`:
- `contextMenu` state → becomes local state in each view, or lifted to App.tsx
- Render logic → `ContextMenu` component
- Submenu hover logic
- CSS → `context-menu.module.css`

### FilesView Creation

`FilesView.tsx` wraps:
- `FilesSidebar` (from Phase 2)
- The existing file area (BreadcrumbBar, Toolbar, SelectionBar, FileGrid/List)
- `StatusBar` (from Phase 5 — or skip for now)

### Props Pattern

Each extracted view receives its handlers as props:

```typescript
type FilesViewProps = {
  // Navigation
  currentPath: string;
  onNavigate: (path: string) => void;
  onGoUp: () => void;
  onGoBack: () => void;
  // Files
  entries: FileEntry[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  // View mode
  viewMode: 'list' | 'grid' | 'columns';
  onSetViewMode: (mode: 'list' | 'grid' | 'columns') => void;
  // ... more as needed
};
```

### Verification
- Views behave identically to before extraction
- No new bugs in desktop, trash, files, or jobs views
- Refactored code compiles cleanly
- All CSS still renders correctly

---

## Phase 4: Settings Reorganization

### Tasks
1. Add sidebar nav to SettingsPanel per [desktop-settings.md](./desktop-settings.md)
2. Add filter/search input to settings nav
3. Move settings content into named categories
4. Add keyboard navigation support
5. Extract existing settings CSS from App.module.css → SettingsPanel.module.css (if not already done)

### Verification
- Settings panel shows sidebar nav with categories
- Clicking a category jumps to that section
- Filter narrows visible categories/items
- Escape closes settings panel
- Keyboard up/down/enter works in nav

---

## Phase 5: Context Menus

### Tasks
1. Extract `ContextMenu.tsx` + `context-menu.module.css` (if not done in Phase 3)
2. Add desktop-level context menu (right-click on empty space)
3. Add icon-level context menus (right-click on individual desktop icons)
4. Implement submenu support (nested menus on hover)
5. Implement keyboard navigation for context menus (arrow keys, enter, escape)
6. Portal context menus to `document.body`

### Verification
- Right-click desktop → shows New Folder, Paste, Display Settings
- Right-click drive icon → shows Open, Properties context
- Right-click trash icon → shows Open Trash, Empty Trash
- Submenus open on hover
- Click outside → closes menu
- Escape → closes menu

---

## Phase 6: Nautilus UX Polish

### Tasks
1. Add Ctrl+L location entry mode to BreadcrumbBar
2. Add file-type coloring to sidebar section icons
3. Add column header-based sorting controls (replacing dropdown)
4. Add icon sizing / zoom controls
5. Implement proper keyboard focus-ring navigation in file grid
6. Add GNOME-style selection behavior (rubber-band in list mode via existing code, but add click-to-select without modifier)
7. Status bar from [desktop-statusbar.md](./desktop-statusbar.md)

### Status Bar Implementation

Add `<StatusBar />` to `App.tsx`:

```tsx
{showStatusBar && (
  <StatusBar
    visible={showStatusBar}
    totalItems={entries.length}
    selectedCount={selectedIds.size}
    totalBytes={selectedFileBytes}
    rootAvail={currentRoot?.avail ?? null}
    rootSize={currentRoot?.size ?? null}
    rootLabel={currentRoot?.label || currentRoot?.mount || ''}
    currentPath={currentPath}
    viewContext={activeView}
    trashCount={trashEntries.length}
  />
)}
```

### Verification
- Ctrl+L shows location entry in breadcrumbs
- Column headers clickable for sort
- Icon zoom changes file grid density
- Rubber-band selection in list view
- Status bar shows current info
- All tests pass

---

## Testing Strategy

### Per-Phase Testing
1. `npx tsc --noEmit` — TypeScript compilation
2. Manual smoke test:
   - Load app, login
   - Navigate files, double-click folders, back/forward
   - Check desktop, trash, settings, jobs views
   - Test context menus (when implemented)
   - Test closing/opening dialogs
   - Test SSE status indicator
3. `npm run build` — production build

### Cross-Browser Check
- Test in Firefox and Chromium after each phase

### Docker Build Check
```bash
docker compose -f docker-compose.server.yml build
```
