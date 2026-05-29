# Status Bar Spec

A 28px bottom bar showing context-sensitive file/folder information. Shown below the workspace when in Files, Trash, or Desktop views.

## Current Implementation

**File**: `frontend/src/components/layout/StatusBar.tsx` (60 lines)

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 42 items (15 selected) · 2.4 GB free of 240 GB · /mnt/data  │
│ left: item counts        center: storage info    right: path │
└──────────────────────────────────────────────────────────────┘
```

### Props

```typescript
type StatusBarProps = {
  visible: boolean;
  totalItems: number;
  selectedCount: number;
  totalBytes: number;
  rootAvail: number | null;
  rootSize: number | null;
  rootLabel: string;
  currentPath: string;
  viewContext: 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';
  trashCount?: number;
};
```

### Render Logic

- **Files view**: `"42 items (15 selected)"` + bytes if selection has size + `"2.4 GB free of 240 GB"` + path
- **Desktop view**: `"5 items"` + storage info + active root path
- **Trash view**: `"12 items"` (no storage info, no path)
- **Settings / Jobs**: Hidden (`visible` prop controls)

### Data Flow

The StatusBar receives data from `screens/Home.tsx`, which tracks:
- `entries.length` → `totalItems`
- `selectedPaths.length` → `selectedCount`
- Sum of selected file sizes → `totalBytes` (via useMemo)
- Current root usage data via `roots.find(r => currentPath?.startsWith(r.mount))`
- `viewContext` derived from active view state

### Visibility Rules

| View | StatusBar shown? | Content |
|------|-----------------|---------|
| Desktop | Yes | Items count, storage info, active root path |
| Files | Yes | Items count, selection info, storage info, current path |
| Trash | Yes | Items count (no storage info) |
| Settings | No | — |
| Jobs | No | — |

### CSS: `frontend/src/components/layout/StatusBar.module.css`

Fixed 28px height, hidden on mobile (center column hidden below 760px).
