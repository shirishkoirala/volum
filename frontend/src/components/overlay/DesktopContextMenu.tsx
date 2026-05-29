import { useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import type { DesktopIconItem } from '../../pages/DesktopView';
import styles from './ContextMenu.module.css';

interface DesktopContextMenuProps {
  x: number;
  y: number;
  item: DesktopIconItem;
  trashCount: number;
  onRefresh: () => void;
  onEmptyTrash: () => void;
  onRemoveFavorite: (path: string) => void;
  onClose: () => void;
}

export function DesktopContextMenu({
  x, y, item, trashCount,
  onRefresh, onEmptyTrash, onRemoveFavorite, onClose,
}: DesktopContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons || buttons.length === 0) return;
      const current = document.activeElement;
      const idx = Array.from(buttons).indexOf(current as HTMLButtonElement);
      const next = e.key === 'ArrowDown'
        ? (idx + 1) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }

  const favPath = item.type === 'folderShortcut' ? item.id.replace(/^fav-/, '') : null;

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 300) }}
      onClick={(e) => { e.stopPropagation(); }}
      onKeyDown={handleKeyDown}
      role="menu"
      tabIndex={-1}
    >
      {item.type !== 'emptySpace' && (
        <button type="button" onClick={() => { item.onClick(); onClose(); }} role="menuitem">
          <Icon name="document-open" size={16} /> Open {item.label}
        </button>
      )}
      {item.type === 'myPC' && (
        <button type="button" onClick={() => { onRefresh(); onClose(); }} role="menuitem">
          <Icon name="view-refresh" size={16} /> Refresh drives
        </button>
      )}
      {item.type === 'trash' && trashCount > 0 && (
        <button type="button" className={styles.danger} onClick={() => { onEmptyTrash(); onClose(); }} role="menuitem">
          <Icon name="edit-delete" size={16} /> Empty Trash
        </button>
      )}
      {item.type === 'folderShortcut' && favPath && (
        <button type="button" onClick={() => { onRemoveFavorite(favPath); onClose(); }} role="menuitem">
          <Icon name="bookmark-new" size={16} /> Remove from desktop
        </button>
      )}
      {item.type === 'emptySpace' && (
        <button type="button" onClick={() => { onRefresh(); onClose(); }} role="menuitem">
          <Icon name="view-refresh" size={16} /> Refresh
        </button>
      )}
    </div>
  );
}
