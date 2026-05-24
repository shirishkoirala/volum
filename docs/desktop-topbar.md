# Top Bar Spec

A 44px persistent bar at the top of the Volum Desktop shell containing the brand, optional app menu, and system controls.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Volum Desktop]           app menu           clock  sys ▸│
│ left (brand)             center (app)     right (system) │
└──────────────────────────────────────────────────────────┘
```

## New Component: `frontend/src/components/TopBar.tsx`

### Props
```typescript
type TopBarProps = {
  activeView: 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';
  onGoDesktop: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onOpenShortcuts: () => void;
  session: Session | null;
};
```

### Internal State
```typescript
const [showSystemMenu, setShowSystemMenu] = useState(false);
const [activeAppMenu, setActiveAppMenu] = useState<string | null>(null); // 'file' | 'edit' | 'view' | 'go' | null
const [clock, setClock] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
```

### Render Structure
```tsx
<header className={styles.topbar}>
  <div className={styles.left}>
    <button className={styles.brand} onClick={onGoDesktop} title="Go to desktop" type="button">
      <img className={styles.brandIcon} src={appIcon} alt="" />
      <span className={styles.brandName}>Volum Desktop</span>
    </button>
    {activeView === 'files' && <AppMenu ... />}
  </div>
  <div className={styles.center}>
    <span className={styles.clock}>{clock}</span>
  </div>
  <div className={styles.right}>
    <button className={styles.systemBtn} onClick={onToggleTheme} title="Toggle theme" type="button">
      {theme === 'light' ? <Icon name="weather-clear-night" size={16} /> : <Icon name="weather-clear" size={16} />}
    </button>
    <button className={styles.systemBtn} onClick={() => setShowSystemMenu(!showSystemMenu)} title="System menu" type="button">
      <Icon name="system-search" size={16} />
    </button>
    {showSystemMenu && <SystemMenu onClose={() => setShowSystemMenu(false)} ... />}
  </div>
</header>
```

## CSS: `frontend/src/components/TopBar.module.css`

```css
.topbar {
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  height: 44px;
  padding: 0 8px;
  gap: 4px;
  grid-column: 1 / -1;
  grid-row: 1;
}

.left {
  align-items: center;
  display: flex;
  gap: 4px;
  flex: 1;
}

.center {
  align-items: center;
  display: flex;
}

.right {
  align-items: center;
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.brand {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  transition: background var(--transition-fast);
}

.brand:hover {
  background: var(--color-hover);
}

.brandIcon {
  border-radius: var(--radius-sm);
  height: 24px;
  width: 24px;
}

.brandName {
  font-size: 13px;
  font-weight: 600;
}

.clock {
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 0 8px;
  user-select: none;
}

.systemBtn {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
  display: inline-flex;
  height: 32px;
  justify-content: center;
  transition: background var(--transition-fast);
  width: 32px;
}

.systemBtn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

/* Clock update */
.clock {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 760px) {
  .topbar { height: 38px; padding: 0 4px; }
  .brandName { display: none; } /* Only show icon on small screens */
  .clock { display: none; }
}
```

## App Menu (visible only when activeView === 'files')

The app menu appears to the right of the brand, only when the Files view is active. It provides GNOME-style menu bar with File, Edit, View, Go.

### New component: `AppMenu.tsx` (inside `TopBar.tsx` or standalone)

```tsx
const menuItems = [
  {
    label: 'File',
    id: 'file',
    items: [
      { label: 'New Folder', shortcut: '⇧⌘N', action: onCreateFolder },
      { label: 'Upload Files', shortcut: undefined, action: onUpload },
      { type: 'separator' },
      { label: 'Close', shortcut: '⌘W', action: onGoDesktop },
    ],
  },
  {
    label: 'Edit',
    id: 'edit',
    items: [
      { label: 'Select All', shortcut: '⌘A', action: onSelectAll },
      { label: 'Invert Selection', shortcut: '⌘I', action: onInvertSelection },
      { type: 'separator' },
      { label: 'Copy', shortcut: '⌘C', action: onCopy },
      { label: 'Cut', shortcut: '⌘X', action: onCut },
      { label: 'Paste', shortcut: '⌘V', action: onPaste },
      { type: 'separator' },
      { label: 'Rename', shortcut: 'F2', action: onRename },
      { label: 'Move to Trash', shortcut: 'Delete', action: onDelete },
    ],
  },
  {
    label: 'View',
    id: 'view',
    items: [
      { label: 'List View', shortcut: '⌘1', action: () => setViewMode('list') },
      { label: 'Grid View', shortcut: '⌘2', action: () => setViewMode('grid') },
      { label: 'Column View', shortcut: '⌘3', action: () => setViewMode('columns') },
      { type: 'separator' },
      { label: 'Show Hidden Files', shortcut: '⌘H', action: onToggleHidden },
      { type: 'separator' },
      { label: 'Zoom In', shortcut: '⌘+', action: onZoomIn },
      { label: 'Zoom Out', shortcut: '⌘-', action: onZoomOut },
      { label: 'Reset Zoom', shortcut: '⌘0', action: onResetZoom },
    ],
  },
  {
    label: 'Go',
    id: 'go',
    items: [
      { label: 'Back', shortcut: '⌥←', action: onBreadcrumbBack },
      { label: 'Parent Folder', shortcut: '⌥↑', action: onGoUp },
      { label: 'Home/Desktop', shortcut: '⌥⌫', action: onGoDesktop },
      { type: 'separator' },
      { label: 'Enter Location', shortcut: '⌘L', action: onLocationEntry },
    ],
  },
];
```

The app menu items emit events upward via props. The parent (`App.tsx`) wires them to the existing handler functions.

### Behavior
- Click a menu header (File, Edit, View, Go) → toggles dropdown
- Hover another menu header → switches to that menu
- Click outside → closes all menus
- Escape → closes the active menu

```css
.appMenuBtn {
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 8px;
  transition: background var(--transition-fast);
}

.appMenuBtn:hover,
.appMenuBtn.active {
  background: var(--color-hover);
  color: var(--color-text);
}

.appMenuDropdown {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-menu);
  display: grid;
  gap: 2px;
  min-width: 180px;
  padding: var(--space-sm);
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 40;
}

.appMenuItem {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 16px;
  min-height: 32px;
  padding: 0 10px;
  text-align: left;
  transition: background var(--transition-fast);
}

.appMenuItem:hover {
  background: var(--color-hover);
}

.appMenuShortcut {
  color: var(--color-text-muted);
  font-size: 11px;
  margin-left: auto;
}

.appMenuSeparator {
  border: 0;
  border-top: 1px solid var(--color-border-light);
  margin: 2px 0;
}
```

## System Menu

The system menu is a dropdown from the rightmost gear icon in the top bar. See [desktop-menus.md](./desktop-menus.md) for the full spec.

## Nesting in App.tsx Shell

```tsx
// In App.tsx, within the shell:
<main className={styles.appShell}>
  <TopBar
    activeView={activeView}
    onGoDesktop={() => { setCurrentPath(''); setShowingTrash(false); setShowingSettings(false); setShowingJobs(false); }}
    theme={theme}
    onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    onOpenSettings={() => setShowingSettings(true)}
    onLogout={handleLogout}
    onOpenShortcuts={() => setShortcutsOpen(true)}
    session={session}
  />
  // ... rest unchanged
</main>
```

## Keyboard Shortcuts Handled by TopBar

These global shortcuts are added to the `keydown` listener in App.tsx (lines 338-361 currently):

| Shortcut | Action | Status |
|----------|--------|--------|
| Ctrl+L | Toggle location entry in BreadcrumbBar | New |
| Ctrl+W | Go to desktop (close current view) | New |
| Ctrl+1 | Switch to list view | New |
| Ctrl+2 | Switch to grid view | New |
| Ctrl+3 | Switch to columns view | New |
| Ctrl++ (Ctrl+=) | Zoom in | New |
| Ctrl+- | Zoom out | New |
| Ctrl+0 | Reset zoom | New |
| Alt+Left | Go back (parent folder) | New |
| Alt+Up | Go to parent directory | New |
| Alt+Home | Go to desktop | New |
| Ctrl+Shift+N | New folder | New |
| Space | Preview selected file | New |
