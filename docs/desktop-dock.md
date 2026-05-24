# Dock + Files Sidebar Spec

The 300px sidebar is replaced by two distinct components:

1. **Dock** — persistent 56px left rail with icon-based app launcher
2. **FilesSidebar** — 240px expandable panel shown only when Files view is active

## Dock: `frontend/src/components/Dock.tsx`

### Props
```typescript
type DockItem = {
  id: string;
  label: string;
  icon: string; // URL to SVG asset
  badge?: number;
  active: boolean;
};

type DockProps = {
  items: DockItem[];
  onActivate: (id: string) => void;
};
```

### Layout
```
┌──────┐
│      │
│  🏠  │  ← Home (Desktop)
│  📁  │  ← Files
│  🗑   │  ← Trash (badge: count)
│   3  │
│  ⚙   │  ← Settings
│  📊  │  ← Jobs (badge: active count)
│   2  │
│      │  ← flex spacer
│      │
└──────┘
```

### Render (conceptual)
```tsx
<aside className={styles.dock} role="navigation" aria-label="App dock">
  {items.map((item) => (
    <button
      key={item.id}
      className={`${styles.dockItem}${item.active ? ` ${styles.active}` : ''}`}
      onClick={() => onActivate(item.id)}
      type="button"
      title={item.label}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
    >
      <IconImg src={item.icon} alt="" width={24} height={24} />
      {item.badge != null && item.badge > 0 && (
        <span className={styles.dockBadge} aria-label={`${item.badge} ${item.label.toLowerCase()} items`}>
          {item.badge}
        </span>
      )}
    </button>
  ))}
</aside>
```

### CSS: `frontend/src/components/Dock.module.css`

```css
.dock {
  align-items: center;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: 4px;
  grid-column: 1;
  grid-row: 2 / -1;
  overflow-y: auto;
  padding: 8px 0;
}

.dockItem {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  height: 48px;
  justify-content: center;
  position: relative;
  transition: background var(--transition-fast);
  width: 48px;
}

.dockItem:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.dockItem.active {
  background: var(--color-brand-bg);
}

.dockItem.active::before {
  background: var(--color-brand);
  border-radius: 0 2px 2px 0;
  content: '';
  height: 50%;
  left: -4px;
  position: absolute;
  top: 25%;
  width: 3px;
}

/* Active indicator dot (when window open but not focused — reserved for future) */
.dockItem.open::before {
  background: var(--color-text-muted);
  border-radius: 50%;
  bottom: 4px;
  content: '';
  height: 4px;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 4px;
}

.dockBadge {
  align-items: center;
  background: var(--color-danger);
  border-radius: var(--radius-pill);
  color: #fff;
  display: flex;
  font-size: 9px;
  font-weight: 700;
  height: 16px;
  justify-content: center;
  line-height: 1;
  min-width: 16px;
  padding: 0 4px;
  position: absolute;
  right: 2px;
  top: 2px;
}

@media (max-width: 760px) {
  .dock {
    border-right: 0;
    border-top: 1px solid var(--color-border-light);
    flex-direction: row;
    grid-column: 1;
    grid-row: 3;
    height: 48px;
    justify-content: center;
    overflow-x: auto;
    padding: 4px;
  }

  .dockItem {
    height: 40px;
    width: 40px;
  }

  .dockItem.active::before {
    bottom: -4px;
    height: 3px;
    left: 25%;
    right: 25%;
    top: auto;
    width: 50%;
  }
}
```

### Dock Items Definition (in App.tsx)

```typescript
const dockItems: DockItem[] = useMemo(() => [
  {
    id: 'desktop',
    label: 'Desktop',
    icon: computerIconUrl(),
    active: activeView === 'desktop',
  },
  {
    id: 'files',
    label: 'Files',
    icon: folderIconUrl('64'),
    active: activeView === 'files',
  },
  {
    id: 'trash',
    label: 'Trash',
    icon: trashIconUrl(trashEntries.length > 0, '64'),
    badge: trashEntries.length > 0 ? trashEntries.length : undefined,
    active: activeView === 'trash',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: jobsIconUrl(),
    badge: activeJobCount > 0 ? activeJobCount : undefined,
    active: activeView === 'jobs',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: preferencesIconUrl(),
    active: activeView === 'settings',
  },
], [activeView, trashEntries.length, activeJobCount]);

const handleDockActivate = (id: string) => {
  switch (id) {
    case 'desktop':
      setCurrentPath('');
      setShowingTrash(false);
      setShowingSettings(false);
      setShowingJobs(false);
      setSelectedDriveName(null);
      break;
    case 'files':
      // Already in files view — if on desktop, navigate to last path or home
      if (activeView === 'desktop') {
        navigateTo(favorites[0] || '');
      }
      break;
    case 'trash':
      setCurrentPath('');
      setShowingTrash(true);
      setShowingSettings(false);
      setShowingJobs(false);
      setViewMode((prev) => prev === 'columns' ? 'list' : prev);
      break;
    case 'jobs':
      setShowingJobs(true);
      setShowingSettings(false);
      setShowingTrash(false);
      break 'settings':
      setShowingSettings(true);
      setShowingTrash(false);
      setShowingJobs(false);
      break;
  }
};
```

## FilesSidebar: `frontend/src/components/FilesSidebar.tsx`

This is the file-navigation panel visible ONLY when the Files view is active. It replaces the file-navigation sections of the old sidebar.

### Props
```typescript
type FilesSidebarProps = {
  roots: RootEntry[];
  devices: BlockDevice[];
  favorites: string[];
  recentPaths: string[];
  currentPath: string;
  subdirs: FileEntry[];
  trashCount: number;
  sectionCollapsed: Record<string, boolean>;
  onToggleSection: (section: string) => void;
  onNavigate: (path: string) => void;
  onAddFavorite: (path: string) => void;
  onRemoveFavorite: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};
```

### Layout (240px when expanded, 0px when collapsed)

```
┌────────────────┐
│ ├ Places       │ ← collapsible section
│ │   🏠 /mnt   │ ← current root(s)
│ │   📋 Desktop│
│ │
│ ├ Devices     │ ← collapsible section
│ │   SanDisk128│ → expandable device group
│ │     /mnt/usb│
│ │   Samsung 86│
│ │     /data   │
│ │
│ ├ Bookmarks  │ ← collapsible section
│ │   ★ /mnt/src│
│ │   ★ /etc/   │
│ │
│ ├ Recent     │ ← collapsible section, max 5
│ │   /var/log  │
│ │   /home/usr │
│ │
│ ├ This Folder│ ← collapsible section, max 20 subdirs
│ │   📁 src/  │
│ │   📁 dist/ │
│ │   📁 docs/ │
└────────────────┘
```

### CSS: `frontend/src/components/FilesSidebar.module.css`

The FilesSidebar reuses the visual styling of the current sidebar sections. All sidebar CSS classes from `App.module.css` that relate to file navigation should be moved here:

- `.navSection`, `.sectionHeader`, `.sectionBody`, `.sectionCollapsed`
- `.chevron`, `.chevronCollapsed`
- `.rootList`, `.rootItem`, `.rootDetails`, `.rootMeter`
- `.partitionItem`, `.partitionUnmounted`, `.deviceGroup`, `.deviceHeader`
- `.favDetails`, `.favRemove`
- `.drivePartitionItem`, `.drivePartitionMeter`, `.drivePartitionInfo`

Additional styles:

```css
.filesSidebar {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--space-lg);
  width: 240px;
  transition: width var(--transition-fast), padding var(--transition-fast), opacity var(--transition-fast);
}

.filesSidebar.collapsed {
  width: 0;
  padding: 0;
  opacity: 0;
  overflow: hidden;
  border-right: 0;
}

.sidebarToggleFiles {
  position: absolute;
  right: -14px;
  top: 50%;
  z-index: 5;
  /* same as existing .sidebarToggle styling but positioned in FilesView */
}

@media (max-width: 760px) {
  .filesSidebar {
    width: 180px;
    padding: var(--space-md);
    font-size: 12px;
  }
}
```

### Collapse Toggle

The FilesSidebar has a collapse toggle button at its right edge, same position as the current `.sidebarToggle`. When collapsed, only a thin strip remains visible.

## FilesView Container

Both the FilesSidebar and FileArea are wrapped in a `FilesView` component:

```tsx
export function FilesView({ ... }: FilesViewProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={styles.filesView}>
      {!sidebarCollapsed && (
        <FilesSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          ...
        />
      )}
      <div className={styles.fileArea}>
        {/* BreadcrumbBar, Toolbar, SelectionBar, ColumnHeaders, FileGrid/List, StatusBar */}
      </div>
      <button className={styles.sidebarToggle} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
        <Icon name="go-next" size={16} className={sidebarCollapsed ? '' : styles.rotate} />
      </button>
    </div>
  );
}
```

```css
.filesView {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

.fileArea {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
```

## Migration from Old Sidebar

During Phase 2 of the migration plan:

1. Create `Dock.tsx` — new component, no dependency on old code
2. Create `FilesSidebar.tsx` — copy the sidebar file-navigation sections here
3. In `App.tsx`:
   - Remove the `<aside className={styles.sidebar}>` JSX block
   - Replace with `<Dock ... />` in the same grid column position
   - Wire the dock items to existing state setters
4. In `FilesSidebar.tsx`:
   - Copy the Quick Access sections (Favorites, Recent) and Removable/Current Folder sections from App.tsx
   - Remove the brand and app-level items (This PC, Trash, Jobs) — those are now in the dock
   - Remove the `showingSettings`/`showingTrash`/`showingJobs` interaction — FilesSidebar is only shown during file browsing
5. In `App.tsx`, remove sidebar-related state (`sidebarCollapsed`, `sectionCollapsed` → move to FilesSidebar local state)
