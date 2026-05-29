# Top Bar Spec

A 44px persistent bar at the top of the Volum Desktop shell containing the brand, optional app menu, and clock.

## Current Implementation

**File**: `frontend/src/components/layout/TopBar.tsx` (46 lines)

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Volum Desktop]           Wed, 15 May, 14:30             │
│ left (brand + app menu)         center (clock)           │
└──────────────────────────────────────────────────────────┘
```

Note: No right-aligned system menu or theme toggle — those are handled in SettingsPanel.

### Props

```typescript
type TopBarProps = {
  activeView: 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';
  onGoDesktop: () => void;
  menuHandlers?: AppMenuHandlers;
  title?: string;
};
```

### Render Structure

```tsx
<header className={styles.topbar}>
  <div className={styles.left}>
    <button className={styles.brand} onClick={onGoDesktop}>
      <img className={styles.brandIcon} src={appIcon} alt="" />
      <span className={styles.brandName}>Volum Desktop</span>
    </button>
    {activeView === 'files' && <AppMenuBar handlers={menuHandlers} />}
  </div>
  <div className={styles.center}>
    <span className={styles.clock}>Wed, 15 May, 14:30</span>
  </div>
</header>
```

### Clock

- Updates every 30 seconds via `setInterval`
- Format: `"Wed, 15 May, 14:30"` (weekday, day, month, hour:minute)
- Uses `font-variant-numeric: tabular-nums` for stable width
- Hidden on mobile (below 760px)

### App Menu

The AppMenuBar is a separate component at `frontend/src/components/layout/AppMenuBar.tsx`. It only renders when `activeView === 'files'`. It provides GNOME-style menu bar with File, Edit, View, Go menus that emit events via `menuHandlers` prop.

```typescript
type AppMenuHandlers = {
  onNewFolder: () => void;
  onSelectAll: () => void;
  onInvertSelection: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSetViewMode: (mode: 'list' | 'grid' | 'columns') => void;
  onToggleHidden: () => void;
  onShowShortcuts: () => void;
  onUpload: () => void;
  onGoBack: () => void;
  onGoUp: () => void;
  onGoDesktop: () => void;
  onLocationEntry: () => void;
};
```

### Brand

- Shows app icon (48px PNG from `assets/icon-light.png`) + "Volum Desktop" text
- Text hidden on mobile
- Clicking the brand navigates to the desktop view

### CSS: `frontend/src/components/layout/TopBar.module.css`

Fixed 44px height (38px on mobile), grid-column span, brand icon 24x24px, clock with tabular-nums.
