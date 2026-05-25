import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { ViewMode } from '../../utils/view';
import styles from './AppMenuBar.module.css';

type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

export type AppMenuHandlers = {
  onCreateFolder: () => void;
  onUpload: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onInvertSelection: () => void;
  onRename: () => void;
  onDelete: () => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (value: string) => void;
  onGoDesktop: () => void;
  onGoFiles: () => void;
  onGoTrash: () => void;
  onGoJobs: () => void;
  onGoSettings: () => void;
  onToggleLocation: () => void;
  canWrite: boolean;
};

type MenuId = 'file' | 'edit' | 'view' | 'go';

const MENUS: { id: MenuId; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'edit', label: 'Edit' },
  { id: 'view', label: 'View' },
  { id: 'go', label: 'Go' },
];

type AppMenuBarProps = {
  handlers: AppMenuHandlers;
};

export function AppMenuBar({ handlers }: AppMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [focusIdx, setFocusIdx] = useState<number>(-1);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenMenu(null); setFocusIdx(-1); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenu]);

  const handleMenuKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % MENUS.length;
      setFocusIdx(next);
      setOpenMenu(MENUS[next].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + MENUS.length) % MENUS.length;
      setFocusIdx(prev);
      setOpenMenu(MENUS[prev].id);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu(MENUS[idx].id);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, items: { label: string; disabled?: boolean; onClick: () => void }[], currentIdx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = items.findIndex((item, i) => i > currentIdx && !item.disabled);
      if (nextIdx >= 0) focusMenuItem(items, nextIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = items.findIndex((item, i) => i < currentIdx && !item.disabled);
      if (prevIdx >= 0) focusMenuItem(items, prevIdx);
    }
  };

  const focusMenuItem = (_items: { label: string }[], idx: number) => {
    const el = menuRef.current?.querySelector(`[data-menu-index="${idx}"]`) as HTMLElement | null;
    el?.focus();
  };

  const handleItemClick = (onClick: () => void) => {
    onClick();
    setOpenMenu(null);
  };

  const fileItems = [
    { label: 'New Folder', disabled: !handlers.canWrite, onClick: handlers.onCreateFolder },
    { label: 'Upload', disabled: !handlers.canWrite, onClick: handlers.onUpload },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Close', onClick: handlers.onGoDesktop },
  ];

  const editItems = [
    { label: 'Cut', disabled: !handlers.canWrite, onClick: handlers.onCut },
    { label: 'Copy', onClick: handlers.onCopy },
    { label: 'Paste', disabled: !handlers.canWrite, onClick: handlers.onPaste },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Select All', onClick: handlers.onSelectAll },
    { label: 'Invert Selection', onClick: handlers.onInvertSelection },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Rename', disabled: !handlers.canWrite, onClick: handlers.onRename },
    { label: 'Delete', disabled: !handlers.canWrite, onClick: handlers.onDelete },
  ];

  const viewItems = [
    {
      label: `Grid${handlers.viewMode === 'grid' ? ' ✓' : ''}`,
      onClick: () => handlers.onSetViewMode('grid'),
    },
    {
      label: `List${handlers.viewMode === 'list' ? ' ✓' : ''}`,
      onClick: () => handlers.onSetViewMode('list'),
    },
    {
      label: `Columns${handlers.viewMode === 'columns' ? ' ✓' : ''}`,
      onClick: () => handlers.onSetViewMode('columns'),
    },
    { label: '---', disabled: true, onClick: () => {} },
    {
      label: `${handlers.showHidden ? 'Hide' : 'Show'} Hidden Files`,
      onClick: handlers.onToggleHidden,
    },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Sort by Name', onClick: () => handlers.onSortChange('name:asc') },
    { label: 'Sort by Size', onClick: () => handlers.onSortChange('size:desc') },
    { label: 'Sort by Type', onClick: () => handlers.onSortChange('type:asc') },
    { label: 'Sort by Date', onClick: () => handlers.onSortChange('modifiedAt:desc') },
  ];

  const goItems = [
    { label: 'Desktop', onClick: handlers.onGoDesktop },
    { label: 'Files', onClick: handlers.onGoFiles },
    { label: 'Trash', onClick: handlers.onGoTrash },
    { label: 'Jobs', onClick: handlers.onGoJobs },
    { label: 'Settings', onClick: handlers.onGoSettings },
    { label: '---', disabled: true, onClick: () => {} },
    { label: 'Go to Location...', onClick: handlers.onToggleLocation },
  ];

  const menuItems: Record<MenuId, { label: string; disabled?: boolean; onClick: () => void }[]> = {
    file: fileItems,
    edit: editItems,
    view: viewItems,
    go: goItems,
  };

  return (
    <div className={styles.menuBar} ref={menuBarRef} role="menubar">
      {MENUS.map((menu, idx) => (
        <div key={menu.id} className={styles.menuWrapper}>
          <button
            className={`${styles.menuTrigger}${openMenu === menu.id ? ` ${styles.menuTriggerOpen}` : ''}`}
            onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
            onMouseEnter={() => { if (openMenu) setOpenMenu(menu.id); }}
            onFocus={() => setFocusIdx(idx)}
            onKeyDown={(e) => handleMenuKeyDown(e, idx)}
            role="menuitem"
            tabIndex={focusIdx === idx ? 0 : -1}
            type="button"
          >
            {menu.label}
          </button>
          {openMenu === menu.id && (
            <div className={styles.menuDropdown} ref={menuRef} role="menu">
              {menuItems[menu.id].map((item, itemIdx) =>
                item.label === '---' ? (
                  <div key={itemIdx} className={styles.menuSeparator} role="separator" />
                ) : (
                  <button
                    key={item.label}
                    className={`${styles.menuItem}${item.disabled ? ` ${styles.menuItemDisabled}` : ''}`}
                    onClick={() => { if (!item.disabled) handleItemClick(item.onClick); }}
                    onKeyDown={(e) => handleItemKeyDown(e, menuItems[menu.id], itemIdx)}
                    data-menu-index={itemIdx}
                    disabled={item.disabled}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
