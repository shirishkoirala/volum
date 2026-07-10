import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { ViewMode } from '../../utils/view';
import type { SortField, SortDirection } from '../../types';
import { buildFileItems, buildEditItems, buildViewItems, buildGoItems } from './menuItems';
import type { MenuItem } from './menuItems';
import styles from './AppMenuBar.module.css';

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
  onRestore?: () => void;
  onDeleteForever?: () => void;
  onEmptyTrash?: () => void;
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
  onClose?: () => void;
  canWrite: boolean;
  canUpload: boolean;
  selectedCount: number;
};

type AppMenuBarProps = {
  handlers: AppMenuHandlers;
  windowType?: string;
};

type MenuId = 'file' | 'edit' | 'view' | 'go';

const MENUS: { id: MenuId; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'edit', label: 'Edit' },
  { id: 'view', label: 'View' },
  { id: 'go', label: 'Go' },
];

export function AppMenuBar({ handlers, windowType }: AppMenuBarProps) {
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
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setFocusIdx(-1);
      }
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
      const next = (idx + 1) % menus.length;
      setFocusIdx(next);
      setOpenMenu(menus[next]!.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + menus.length) % menus.length;
      setFocusIdx(prev);
      setOpenMenu(menus[prev]!.id);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu(menus[idx]!.id);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, items: MenuItem[], currentIdx: number) => {
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

  const focusMenuItem = useCallback((_items: MenuItem[], idx: number) => {
    const el = menuRef.current?.querySelector(`[data-menu-index="${idx}"]`) as HTMLElement | null;
    el?.focus();
  }, []);

  const menus = windowType === 'trash' ? MENUS.filter((menu) => menu.id !== 'view') : MENUS;

  const handleItemClick = useCallback((onClick: () => void) => {
    onClick();
    setOpenMenu(null);
  }, []);

  const fileItems = useMemo(() => buildFileItems(handlers, windowType), [handlers, windowType]);
  const editItems = useMemo(() => buildEditItems(handlers, windowType), [handlers, windowType]);
  const viewItems = useMemo(() => buildViewItems(handlers), [handlers]);
  const goItems = useMemo(() => buildGoItems(handlers, windowType), [handlers, windowType]);

  const menuItems: Record<MenuId, MenuItem[]> = useMemo(
    () => ({
      file: fileItems,
      edit: editItems,
      view: viewItems,
      go: goItems,
    }),
    [fileItems, editItems, viewItems, goItems],
  );

  return (
    <div className={styles.menuBar} ref={menuBarRef} role="menubar">
      {menus.map((menu, idx) => (
        <div key={menu.id} className={styles.menuWrapper}>
          <button
            className={`${styles.menuTrigger}${openMenu === menu.id ? ` ${styles.menuTriggerOpen}` : ''}`}
            onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu(menu.id);
            }}
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
                    className={`${styles.menuItem}${item.disabled ? ` ${styles.menuItemDisabled}` : ''}${item.danger ? ` ${styles.danger}` : ''}`}
                    onClick={() => {
                      if (!item.disabled) handleItemClick(item.onClick);
                    }}
                    onKeyDown={(e) => handleItemKeyDown(e, menuItems[menu.id], itemIdx)}
                    data-menu-index={itemIdx}
                    disabled={item.disabled}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    {item.icon && <Icon name={item.icon} size={16} className={styles.menuIcon} />}
                    {item.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
