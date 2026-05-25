import { useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import styles from './ContextMenu.module.css';

interface TrashContextMenuProps {
  x: number;
  y: number;
  onRestore: () => void;
  onDeletePermanently: () => void;
  onClose: () => void;
}

export function TrashContextMenu({ x, y, onRestore, onDeletePermanently, onClose }: TrashContextMenuProps) {
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
      buttons[next].focus();
    }
  }

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 300) }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      role="menu"
      tabIndex={-1}
    >
      <button type="button" onClick={() => { onRestore(); onClose(); }} role="menuitem">
        <Icon name="edit-restore" size={16} /> Restore
      </button>
      <button type="button" className={styles.danger} onClick={() => { onDeletePermanently(); onClose(); }} role="menuitem">
        <Icon name="edit-delete" size={16} /> Delete permanently
      </button>
    </div>
  );
}
