import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
type ViewMode = 'list' | 'grid';
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
  const [focusIdx, setFocusIdx] = useState(0);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menus = windowType === 'trash' ? MENUS.filter((menu) => menu.id !== 'view') : MENUS;
  const menuItems: Record<MenuId, MenuItem[]> = {
    file: buildFileItems(handlers, windowType),
    edit: buildEditItems(handlers, windowType),
    view: buildViewItems(handlers),
    go: buildGoItems(handlers, windowType),
  };

  const focusTrigger = useCallback((idx: number) => {
    menuBarRef.current?.querySelector<HTMLElement>(`[data-menu-trigger="${idx}"]`)?.focus();
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenMenu(null);
        focusTrigger(focusIdx);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [focusIdx, focusTrigger, openMenu]);

  useEffect(() => {
    if (!openMenu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [openMenu]);

  const moveToMenu = (idx: number, direction: -1 | 1, keepOpen: boolean) => {
    const next = (idx + direction + menus.length) % menus.length;
    setFocusIdx(next);
    if (keepOpen) setOpenMenu(menus[next]!.id);
    focusTrigger(next);
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveToMenu(idx, 1, openMenu !== null);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveToMenu(idx, -1, openMenu !== null);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu(menus[idx]!.id);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      setOpenMenu(null);
      return;
    }

    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
    );
    const currentIndex = buttons.indexOf(e.currentTarget as HTMLButtonElement);
    if (buttons.length === 0 || currentIndex < 0) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const direction = e.key === 'ArrowDown' ? 1 : -1;
      buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      buttons[e.key === 'Home' ? 0 : buttons.length - 1]?.focus();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const menuIndex = menus.findIndex((menu) => menu.id === openMenu);
      moveToMenu(menuIndex, e.key === 'ArrowRight' ? 1 : -1, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpenMenu(null);
      focusTrigger(focusIdx);
    }
  };

  const handleItemClick = useCallback(
    (onClick: () => void) => {
      onClick();
      setOpenMenu(null);
      focusTrigger(focusIdx);
    },
    [focusIdx, focusTrigger],
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
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.id}
            data-menu-trigger={idx}
          >
            {menu.label}
          </button>
          {openMenu === menu.id && (
            <div
              className={styles.menuDropdown}
              ref={menuRef}
              role="menu"
              aria-label={`${menu.label} menu`}
            >
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
                    onKeyDown={handleItemKeyDown}
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
