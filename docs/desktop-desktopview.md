# Desktop View + Context Menus Spec

The desktop view is the initial landing screen — a GNOME Nautilus-style desktop showing root drives/mounts, trash icon, and right-click context menus.

## Current Desktop View (App.tsx)

The current "This PC" desktop renders:

```tsx
<section className={styles.desktop}>
  <div className={styles.desktopIconWrapper}>
    {roots.map(root => (
      <div key={root.id} className={styles.desktopIcon}>
        <IconImg src={computerIconUrl()} ... />
        <div className={styles.desktopIconLabel}>{root.mount}</div>
        {root.avail != null && root.size != null && (
          <div className={styles.desktopIconUsage}><div ... /></div>
        )}
      </div>
    ))}
    <div className={desktopIcon} onClick={...}>
      {trashSrc && <IconImg src={trashSrc} ... />}
      <TrashBadge count={trashEntries.length} />
      <div className={styles.desktopIconLabel}>Trash</div>
    </div>
    {drives.map(drive => (
      <div key={drive.name} className={styles.desktopIcon}>
        <IconImg src={driveIconUrl()} ... />
        <div className={styles.desktopIconLabel}>{drive.name}</div>
        ...
      </div>
    ))}
  </div>
</section>
```

## Target: `frontend/src/components/DesktopView.tsx`

### Props
```typescript
type DesktopViewProps = {
  roots: RootEntry[];
  drives: DriveInfo[];
  trashEntries: FileEntry[];
  blockedRoots: string[];
  openSettings: () => void;
  navigateTo: (root: string) => void;
  navigateToTrash: () => void;
  navigateToDrive: (driveName: string) => void;
  onRefreshTrash: () => void;
};
```

### Render Structure
```tsx
<section className={styles.desktop} onContextMenu={handleContextMenu}>
  {/* Grid of desktop icons */}
  <div className={styles.desktopIconGrid}>
    {/* Each root (drive) shows as a desktop icon */}
    {roots.map(root => (
      <div
        key={root.id}
        className={`${styles.desktopIcon}${blockedRoots.includes(root.id) ? ` ${styles.blocked}` : ''}`}
        onClick={() => navigateTo(root.mount)}
        onDoubleClick={() => navigateTo(root.mount)}
        onContextMenu={(e) => handleIconContextMenu(e, root)}
        role="button"
        tabIndex={0}
        aria-label={root.label || root.mount}
      >
        <IconImg src={computerIconUrl()} alt="" width={48} height={48} />
        <div className={styles.desktopIconLabel}>{root.label || root.mount}</div>
        {root.avail != null && root.size != null && (
          <div className={styles.desktopIconUsage}>
            <RootMeter
              used={root.size - root.avail}
              total={root.size}
              available={root.avail}
            />
          </div>
        )}
        {blockedRoots.includes(root.id) && (
          <div className={styles.blockedOverlay}>Unavailable</div>
        )}
      </div>
    ))}

    {/* Trash icon */}
    <div
      className={styles.desktopIcon}
      onClick={navigateToTrash}
      onDoubleClick={navigateToTrash}
      role="button"
      tabIndex={0}
      aria-label="Trash"
    >
      <div className={styles.trashIconWrapper}>
        <IconImg
          src={trashIconUrl(trashEntries.length > 0)}
          alt=""
          width={48}
          height={48}
        />
        {trashEntries.length > 0 && (
          <span className={styles.desktopTrashBadge}>{trashEntries.length}</span>
        )}
      </div>
      <div className={styles.desktopIconLabel}>Trash</div>
      <div className={styles.desktopIconSubtext}>
        {trashEntries.length === 0 ? 'Empty' : `${trashEntries.length} item${trashEntries.length === 1 ? '' : 's'}`}
      </div>
    </div>

    {/* Block device drives */}
    {drives.map(drive => (
      <div
        key={drive.name}
        className={styles.desktopIcon}
        onClick={() => navigateToDrive(drive.name)}
        onDoubleClick={() => navigateToDrive(drive.name)}
        role="button"
        tabIndex={0}
        aria-label={drive.name}
      >
        <IconImg src={driveIconUrl()} alt="" width={48} height={48} />
        <div className={styles.desktopIconLabel}>{drive.name}</div>
        {drive.partitions && drive.partitions.length > 0 && (
          <div className={styles.desktopIconSubtext}>
            {drive.partitions.length} partition{drive.partitions.length === 1 ? '' : 's'}
          </div>
        )}
      </div>
    ))}
  </div>

  {/* Desktop context menu */}
  {contextMenu && <DesktopContextMenu ... />}
</section>
```

## Context Menus

### Desktop Context Menu (right-click on empty space)

```typescript
const desktopMenuItems: ContextMenuItem[] = [
  { label: 'New Folder', action: () => createFolderOnDesktop() },
  { label: 'New Document', submenu: [
    { label: 'Empty File', action: () => createFile('Untitled Document') },
    { label: 'Text File (.txt)', action: () => createFile('Untitled.txt') },
    { label: 'Markdown (.md)', action: () => createFile('README.md') },
  ]},
  { type: 'separator' },
  { label: 'Paste', action: pasteFromClipboard, disabled: !clipboardContent },
  { type: 'separator' },
  { label: 'Reload Desktop', action: () => fetchAll() },
  { label: 'Open in Terminal', action: () => openTerminal(''), disabled: true }, // future
  { type: 'separator' },
  { label: 'Change Background...', action: () => setShowingSettings(true), disabled: true }, // future
  { label: 'Display Settings...', action: () => setShowingSettings(true) },
];
```

### Icon Context Menu (right-click on a specific icon)

```typescript
const iconMenuItems: ContextMenuItem[] = [
  { label: 'Open', action: () => navigateTo(root.mount) },
  { label: 'Open in New Tab', action: () => navigateTo(root.mount), disabled: true }, // future
  { type: 'separator' },
  { label: 'Properties', action: () => openProperties(root) },
  { type: 'separator' },
  { label: 'Unmount', action: () => unmountRoot(root.id), icon: 'media-eject' },
];
```

### CSS: `frontend/src/components/DesktopView.module.css`

```css
/* Move existing App.module.css .desktop, .desktopIcon, etc. here */

.desktop {
  align-content: start;
  display: grid;
  gap: var(--space-md);
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  padding: var(--space-xl);
  overflow-y: auto;
  flex: 1;
}

.desktopIconGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  align-content: start;
}

.desktopIcon {
  align-items: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 100px;
  max-width: 140px;
  padding: 12px 8px;
  text-align: center;
  transition: background var(--transition-fast);
  user-select: none;
}

.desktopIcon:hover {
  background: var(--color-hover);
}

.desktopIcon:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}

.desktopIcon.blocked {
  opacity: 0.5;
  cursor: not-allowed;
}

.desktopIconLabel {
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.desktopIconSubtext {
  color: var(--color-text-muted);
  font-size: 10px;
}

.desktopIconUsage {
  width: 100%;
}

.trashIconWrapper {
  position: relative;
}

.desktopTrashBadge {
  align-items: center;
  background: var(--color-danger);
  border-radius: var(--radius-pill);
  color: #fff;
  display: flex;
  font-size: 9px;
  font-weight: 700;
  height: 18px;
  justify-content: center;
  min-width: 18px;
  padding: 0 4px;
  position: absolute;
  right: -4px;
  top: -4px;
}

.blockedOverlay {
  background: var(--color-danger-soft);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: 10px;
  font-weight: 600;
  margin-top: 2px;
  padding: 1px 6px;
}
```

## Context Menu Component

The current context menu code in `App.tsx` (around lines 848-958) renders an absolutely-positioned div with `position: fixed` at mouse coordinates. It already supports submenus, separators, and disabled items. This should be extracted to a reusable component with the following interface:

### Props
```typescript
type ContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

type ContextMenuItem = {
  label?: string;
  action?: () => void;
  type?: 'separator' | 'item';
  disabled?: boolean;
  submenu?: ContextMenuItem[];
  icon?: string;
  badge?: number;
  shortcut?: string;
  danger?: boolean; // render in red for destructive actions
};
```

### ContextMenu as a Portal

```tsx
import { createPortal } from 'react-dom';

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay listener to avoid the initial click closing the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={styles.contextMenu}
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <hr className={styles.contextMenuSeparator} key={i} />
        ) : (
          <ContextMenuItemComponent key={i} item={item} onClose={onClose} />
        )
      )}
    </div>,
    document.body
  );
}
```

### Submenu Handling

When a menu item has a `submenu` array, hovering it opens a submenu to the right. The submenu follows the same pattern as the existing implementation (currently at about line 876 in App.tsx).

### CSS — Existing styles to keep

The current context menu CSS in App.module.css (around lines 670-835) is comprehensive and well-designed. It should be extracted to a shared `context-menu.module.css`.

## Desktop File Operations

When a user right-clicks on desktop and selects "New Folder" or "New Document", the file is created at the first available root mount (typically `/mnt` or root mount). The `createFolderOnDesktop` and `createFile` functions can call the existing `createFolder` / `createItem` API handlers.

```typescript
const createFolderOnDesktop = async () => {
  const name = 'New Folder';
  const target = roots[0]?.mount || '';
  const res = await api.createFolder(target, name);
  if (res.ok) {
    await fetchAll();
  }
};
```

## Trash Desktop Icon

The desktop trash icon shows:
- Full trash icon when trash has items, empty trash icon otherwise
- Badge count (1-99+, shows "99+" for >99)
- Subtitle text: "Empty" or "N items"
- Double-click → navigate to trash view
- Right-click → context menu with "Open Trash", "Empty Trash..."

```typescript
const trashContextMenu: ContextMenuItem[] = [
  { label: 'Open Trash', action: navigateToTrash },
  { type: 'separator' },
  {
    label: 'Empty Trash...',
    action: confirmEmptyTrash,
    disabled: trashEntries.length === 0,
    danger: true,
  },
];
```

## Keyboard Navigation on Desktop

| Key | Action |
|-----|--------|
| Arrow keys | Move focus between desktop icons |
| Enter | Activate focused icon (open drive or trash) |
| Delete | Move selected item to trash (when focus is on trash icon? No-op for desktop) |
| Ctrl+A | Select all (no-op for desktop icons) |

The desktop icons use `role="button"` and `tabIndex={0}`, requiring the container to handle arrow key focus management.
