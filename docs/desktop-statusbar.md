# Status Bar Spec

A 28px bottom bar showing context-sensitive file/folder information. Shown below the workspace when in Files, Trash, or Desktop views.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 42 items (15 selected) · 2.4 GB free of 240 GB · /mnt/data  │
│ left: item counts        center: storage info    right: path │
└──────────────────────────────────────────────────────────────┘
```

## New Component: `frontend/src/components/StatusBar.tsx`

### Props
```typescript
type StatusBarProps = {
  visible: boolean;
  // File-level stats
  totalItems: number;
  selectedCount: number;
  totalBytes: number;
  // Root-level storage info
  rootAvail: number | null;
  rootSize: number | null;
  rootLabel: string;
  // Breadcrumb path
  currentPath: string;
  // View context
  viewContext: 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';
  trashCount?: number;
};
```

### Render Logic

```tsx
import { formatBytes } from '../App'; // or extract to a shared util

function StatusBar({ visible, totalItems, selectedCount, totalBytes, rootAvail, rootSize, rootLabel, currentPath, viewContext, trashCount }: StatusBarProps) {
  if (!visible) return null;

  const itemText = (() => {
    if (viewContext === 'trash') {
      const count = trashCount ?? 0;
      return `${count} item${count === 1 ? '' : 's'}`;
    }
    if (viewContext === 'desktop') {
      return `${totalItems} item${totalItems === 1 ? '' : 's'}`;
    }
    // Files view
    if (selectedCount > 0) {
      return `${totalItems} item${totalItems === 1 ? '' : 's'} (${selectedCount} selected)`;
    }
    return `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  })();

  const storageText = (rootAvail != null && rootSize != null)
    ? `${formatBytes(rootAvail)} free of ${formatBytes(rootSize)}`
    : '';

  const pathText = rootLabel || currentPath;

  // When items are selected, show total bytes
  const bytesText = selectedCount > 0 && totalBytes > 0
    ? ` · ${formatBytes(totalBytes)}`
    : '';

  return (
    <footer className={styles.statusBar} role="status" aria-live="polite">
      <span className={styles.statusLeft}>
        {itemText}{bytesText}
      </span>
      {storageText && (
        <span className={styles.statusCenter}>{storageText}</span>
      )}
      {pathText && (
        <span className={styles.statusRight}>{pathText}</span>
      )}
    </footer>
  );
}
```

## CSS: `frontend/src/components/StatusBar.module.css`

```css
.statusBar {
  align-items: center;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  font-size: 11px;
  gap: var(--space-md);
  height: 28px;
  padding: 0 var(--space-md);
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  grid-column: 2;
  grid-row: 3;
}

.statusLeft {
  color: var(--color-text-secondary);
  flex: 0 0 auto;
}

.statusCenter {
  color: var(--color-text-muted);
  flex: 1;
  text-align: center;
}

.statusRight {
  color: var(--color-text-muted);
  flex: 0 0 auto;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 760px) {
  .statusBar {
    font-size: 10px;
    height: 24px;
    padding: 0 var(--space-sm);
  }

  .statusCenter {
    display: none;
  }
}
```

## Data Flow

The status bar receives data from the parent (`App.tsx`), which already tracks:

- `entries.length` → `totalItems`
- `selectedIds.size` → `selectedCount`
- Sum of selected file sizes → `totalBytes` (needs a new memo)
- Current root usage data via `roots.find(r => currentPath?.startsWith(r.mount))`
- `viewContext` derived from `activeView`

### New memo needed in App.tsx

```typescript
const selectedFileBytes = useMemo(() => {
  let total = 0;
  selectedIds.forEach((id) => {
    const entry = entries.find((e) => e.name === id);
    if (entry?.size) total += entry.size;
  });
  return total;
}, [selectedIds, entries]);
```

## Visibility Rules

| View | StatusBar shown? | Content |
|------|-----------------|---------|
| Desktop | Yes | Items count, storage info, active root path |
| Files | Yes | Items count, selection info, storage info, current path |
| Trash | Yes | Items count |
| Settings | No | — |
| Jobs | No | — |

Controls in App.tsx:
```tsx
const showStatusBar = activeView !== 'settings' && activeView !== 'jobs';
```

## Future Enhancements

- Job progress bar in status bar when jobs are running (replaces center text)
- Transfer speed indicator during file operations
- Click on root path → navigate to root in Files view
- Network connectivity indicator
- Storage warning (text turns red/amber when <5% free)
