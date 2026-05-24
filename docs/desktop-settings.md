# Settings Reorganization Spec

The settings panel is converted from a flat-scroll layout to a two-column layout with a sidebar navigation (200px) and a content area (flex: 1). This follows GNOME Settings app conventions.

## Current Layout (SettingsPanel.tsx)

```
┌──────────────────────────────────────┐
│ Settings                         [X] │  ← header with close
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ File Manager                     │ │  ← category title
│ │   General                        │ │  ← setting item
│ │   Search                         │ │
│ │   View Modes                     │ │
│ │   Shortcuts                      │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Storage                          │ │  ← category title  
│ │   Available Roots / Health       │ │  ← setting items
│ │   Drives                         │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Administration                   │ │  ← category title
│ │   Database Maintenance           │ │  ← setting items
│ │   Server Info                    │ │
│ │   Share Management               │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ About                            │ │  ← category title
│ │   Version, License               │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## Target Layout

```
┌──────────────────────────────────────────────────────┐
│ Settings                                         [X] │  ← header with close
├─────────────┬────────────────────────────────────────┤
│ Preferences │ File Manager                           │  ← active category
├─────────────┤   General                              │
│ File Manager│     ☐ Automatically search when typing │
│ Storage     │     ☐ Show thumbnails for images       │
│ Admin       │     ☐ Confirm before deleting          │
│ About       │                                        │
│             │   Search                               │
│             │     [indexed paths...]                 │
│             │                                        │
│             │   Shortcuts                            │
│             │     Keyboard shortcut reference...     │
├─────────────┤                                        │
│ (takes 200px)│              (takes flex: 1)           │
└─────────────┴────────────────────────────────────────┘
```

## Props
```typescript
type SettingsPanelProps = {
  variant: 'overlay' | 'page';
  onClose: () => void;
  // Existing props from current SettingsPanel
  session: Session | null;
  roots: RootEntry[];
  drives: BlockDevice[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenShortcuts: () => void;
  onRefreshRoots: () => void;
  // ... all current SettingsPanel props
};
```

## Internal State
```typescript
const [activeCategory, setActiveCategory] = useState<string>('file-manager');
```

## Categories

```typescript
const categories: SettingsCategory[] = [
  {
    id: 'file-manager',
    label: 'File Manager',
    icon: 'folder',
    items: [
      { id: 'general', label: 'General', component: GeneralSettings },
      { id: 'search', label: 'Search', component: SearchSettings },
      { id: 'view-modes', label: 'View Modes', component: ViewModeSettings },
      { id: 'shortcuts', label: 'Shortcuts', component: ShortcutSettings },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'drive-harddisk',
    items: [
      { id: 'roots', label: 'Available Roots', component: RootSettings },
      { id: 'devices', label: 'Devices & Drives', component: DeviceSettings },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'preferences-system',
    items: [
      { id: 'database', label: 'Database Maintenance', component: DatabaseSettings },
      { id: 'server', label: 'Server Info', component: ServerInfo },
      { id: 'shares', label: 'Share Management', component: ShareManagerSettings },
    ],
  },
  {
    id: 'about',
    label: 'About',
    icon: 'help-about',
    items: [
      { id: 'version', label: 'Version', component: AboutInfo },
      { id: 'license', label: 'License', component: LicenseInfo },
    ],
  },
];
```

## Render Structure

```tsx
<section className={styles.settingsPanel}>
  <header className={styles.settingsHeader}>
    <h2 className={styles.settingsTitle}>Settings</h2>
    <button className={styles.settingsClose} onClick={onClose} aria-label="Close settings">
      <Icon name="window-close" size={20} />
    </button>
  </header>

  <div className={styles.settingsBody}>
    <nav className={styles.settingsNav} aria-label="Settings categories">
      <ul className={styles.settingsNavList}>
        {categories.map((cat) => (
          <li key={cat.id}>
            <button
              className={`${styles.settingsNavItem}${activeCategory === cat.id ? ` ${styles.active}` : ''}`}
              onClick={() => setActiveCategory(cat.id)}
              aria-current={activeCategory === cat.id ? 'true' : undefined}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>

    <div className={styles.settingsContent}>
      {categories
        .find((c) => c.id === activeCategory)
        ?.items.map((item) => (
          <section key={item.id} className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>{item.label}</h3>
            <div className={styles.settingsSectionBody}>
              {item.component && <item.component ... />}
            </div>
          </section>
        ))}
    </div>
  </div>
</section>
```

## CSS: Updates to SettingsPanel.module.css

```css
.settingsPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.settingsBody {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settingsNav {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
  overflow-y: auto;
  padding: var(--space-md);
  width: 200px;
}

.settingsNavList {
  list-style: none;
  margin: 0;
  padding: 0;
}

.settingsNavItem {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  gap: 10px;
  min-height: 36px;
  padding: 0 10px;
  text-align: left;
  transition: background var(--transition-fast);
  width: 100%;
}

.settingsNavItem:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.settingsNavItem.active {
  background: var(--color-brand-bg);
  color: var(--color-brand);
  font-weight: 600;
}

.settingsContent {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
}

.settingsSection {
  margin-bottom: var(--space-lg);
}

.settingsSection:last-child {
  margin-bottom: 0;
}

.settingsSectionTitle {
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text);
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 var(--space-md) 0;
  padding-bottom: var(--space-sm);
}

.settingsSectionBody {
  composes: settingsDetails from './App.module.css';
}
```

## Existing Settings Content Should Stay

All existing SettingsPanel content (roots, drives, DB maintenance, server info, shares, shortcuts, theme toggle, logout button, share management) moves into the appropriate category section component. The content must remain functionally identical — only the container layout changes.

## Filter/Search in Settings

Add a filter input at the top of the settings nav:

```tsx
<input
  type="text"
  className={styles.settingsFilter}
  placeholder="Search settings..."
  value={filterQuery}
  onChange={(e) => setFilterQuery(e.target.value)}
/>
```

When `filterQuery` is non-empty, categories and items are filtered to only show matches against `item.label` and `cat.label`.

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Up/Down | Navigate between nav items |
| Right/Enter | Activate selected category |
| Escape | Close settings panel |
| Ctrl+F | Focus filter input |

## Media Query for Mobile

```css
@media (max-width: 760px) {
  .settingsBody {
    flex-direction: column;
  }

  .settingsNav {
    border-bottom: 1px solid var(--color-border-light);
    border-right: 0;
    flex-direction: row;
    min-width: 0;
    overflow-x: auto;
    padding: var(--space-sm);
    width: 100%;
  }

  .settingsNavList {
    display: flex;
    gap: 2px;
  }

  .settingsNavItem {
    white-space: nowrap;
    flex-shrink: 0;
  }
}
```
