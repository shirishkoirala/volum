# Desktop View Spec

The desktop view is the initial landing screen — a GNOME Nautilus-style desktop showing root drives/mounts, trash icon, favorite folder shortcuts, and action icons (Settings, Jobs, Files).

## Current Implementation

**File**: `frontend/src/pages/DesktopView.tsx` (370 lines)

The desktop renders a grid of draggable, reorderable icons. Icon order is persisted to localStorage under `volum_desktopOrder`.

### Desktop Icons

| Icon | Type | Description |
|------|------|-------------|
| My PC | `myPC` | Shows each root mount with usage meter; blocked/unavailable roots shown with warning overlay |
| Trash | `trash` | Badge count (shows "99+" for >99), subtitle "Empty" or "N items", icon toggles between empty/full |
| Settings | `settings` | Opens settings panel |
| Jobs | `jobs` | Opens transfer history |
| Files | `files` | Opens file browser |
| Folder shortcuts | `folderShortcut` | User-favorited folders shown with folder bookmark icon |

### Props

```typescript
type DesktopViewProps = {
  devices: BlockDevice[];
  roots: RootEntry[];
  trashEntries: TrashEntry[];
  jobs: Job[];
  favorites: string[];
  selectedDriveName: string | null;
  onNavigateTo: (path: string) => void;
  onNavigateToTrash: () => void;
  onOpenSettings: () => void;
  onOpenJobs: () => void;
  onOpenFiles: () => void;
  onSelectDrive: (name: string | null) => void;
  showingMyPC: boolean;
  onShowMyPC: (v: boolean) => void;
  deviceError?: string | null;
  onRetryDevices?: () => void;
  wallpaperStyle?: React.CSSProperties;
  onItemContextMenu: (item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => void;
};
```

### Icon Reordering

Users can drag desktop icons to rearrange them. The order is saved to `localStorage` key `volum_desktopOrder`. On mount, icons load in the saved order; new icons are appended at the end. A "Restore Default Layout" button resets the order.

### Wallpaper / Background

The desktop supports customizable backgrounds via the `wallpaperStyle` prop. A wrapper div (`.desktopWrapper`) applies the background CSS. The wallpaper is configured in Settings → Desktop.

### DesktopIconItem Type

```typescript
type DesktopIconItem = {
  id: string;
  type: 'myPC' | 'trash' | 'settings' | 'jobs' | 'files' | 'folderShortcut' | 'emptySpace';
  label: string;
  ariaLabel: string;
  onClick: () => void;
  badge?: number;
  icon?: React.ReactNode;
};
```

### Context Menus

Right-click behavior is handled by three separate components extracted from the desktop:

| Component | File |
|-----------|------|
| `DesktopContextMenu` | `frontend/src/components/overlay/DesktopContextMenu.tsx` |
| `FileContextMenu` | `frontend/src/components/overlay/FileContextMenu.tsx` |
| `TrashContextMenu` | `frontend/src/components/overlay/TrashContextMenu.tsx` |

Right-click on empty space shows the desktop context menu with "New Folder", "New Document" submenu, "Paste" (if clipboard has content), and "Display Settings".

### CSS: `frontend/src/pages/DesktopView.module.css`

The desktop uses a flexbox icon grid layout with drag-and-drop visual feedback. Icon hover states, blocked overlays, and trash badge styling are all defined in the module.
