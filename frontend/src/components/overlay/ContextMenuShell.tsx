import { useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import styles from './ContextMenu.module.css';

interface ContextMenuShellProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

export function ContextMenuShell({ x, y, onClose, children }: ContextMenuShellProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  function handleKeyDown(e: KeyboardEvent) {
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
      {children}
    </div>
  );
}
