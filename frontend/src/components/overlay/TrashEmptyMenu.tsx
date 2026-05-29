import { useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import styles from './ContextMenu.module.css';

interface TrashEmptyMenuProps {
  x: number;
  y: number;
  canPaste: boolean;
  onRefresh: () => void;
  onPaste: () => void;
  onClose: () => void;
}

export function TrashEmptyMenu({
  x, y, canPaste,
  onRefresh, onPaste, onClose,
}: TrashEmptyMenuProps) {
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
      <button type="button" onClick={() => { onRefresh(); onClose(); }} role="menuitem">
        <Icon name="view-refresh" size={16} /> Refresh
      </button>
      <hr className={styles.separator} />
      <button type="button" onClick={() => { onPaste(); }} disabled={!canPaste} role="menuitem">
        <Icon name="edit-paste" size={16} /> Paste
      </button>
    </div>
  );
}
