# Settings Panel Spec

## Current Implementation

**File**: `frontend/src/pages/SettingsPanel.tsx` (311 lines)

The settings panel uses a two-column layout with a sidebar navigation (200px) and a content area (flex: 1).

### Layout

```
┌──────────────────────────────────────────────────────┐
│ Settings (page view, no overlay)                      │
├─────────────┬────────────────────────────────────────┤
│ General     │ General (theme toggle, keyboard         │
│ Server      │   shortcuts, logout)                    │
│ Storage     │                                         │
│ Desktop     │ Server (status, version, uptime)        │
│ Admin       │                                         │
│ About       │ Storage (roots with progress bars,      │
│             │   health warnings)                      │
│             │                                         │
│             │ Desktop (wallpaper picker: 16 colors,   │
│             │   6 gradients, custom picker, default)  │
│             │                                         │
│             │ Admin (DB vacuum, prune transfers,      │
│             │   prune audit logs, share management)   │
│             │                                         │
│             │ About (version, build time, go version) │
├─────────────┴────────────────────────────────────────┤
│ (200px sidebar)       (flex: 1 content area)          │
└──────────────────────────────────────────────────────┘
```

### Props

```typescript
type SettingsPanelProps = {
  onOpenShares?: () => void;
  wallpaper?: WallpaperConfig;
  onWallpaperChange?: (config: WallpaperConfig) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  session: Session | null;
};
```

### Categories

The panel has 6 categories, switched via sidebar navigation:

| ID | Label | Content |
|----|-------|---------|
| `general` | General | Theme toggle, keyboard shortcuts reference, logout |
| `server` | Server | ServerInfo component (version, uptime, Go version, build time) |
| `storage` | Storage | Root mounts with progress bars, unavailable root warnings (in red) |
| `desktop` | Desktop | WallpaperPicker (16 preset colors, 6 gradients, custom color input, default button) |
| `admin` | Administration | DB maintenance (Vacuum, Prune Transfers, Prune Audit Logs), transfer counts, share management button |
| `about` | About | Version, build time, Go runtime info |

### Search

A filter input at the top of the sidebar nav allows searching categories by name. Non-matching categories are hidden.

### Notes

- No overlay variant — always rendered as a page in the workspace (Task 9 removed the variant prop)
- No breadcrumb bar (Task 9 removed BreadcrumbBar from Settings)
- Share management opens the ShareManager overlay component
- Wallpaper is managed through localStorage (`volum_wallpaper`) and the `useWallpaper` hook
