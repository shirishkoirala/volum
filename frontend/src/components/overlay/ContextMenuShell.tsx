import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import styles from './ContextMenu.module.css';

interface ContextMenuShellProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

const VIEWPORT_GAP = 8;
const FALLBACK_WIDTH = 200;
const FALLBACK_HEIGHT = 300;

function clampCoordinate(value: number, size: number, viewportSize: number) {
  return Math.max(VIEWPORT_GAP, Math.min(value, viewportSize - size - VIEWPORT_GAP));
}

export function ContextMenuShell({ x, y, onClose, children }: ContextMenuShellProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => ({
    left: clampCoordinate(x, FALLBACK_WIDTH, window.innerWidth),
    top: clampCoordinate(y, FALLBACK_HEIGHT, window.innerHeight),
  }));
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    function updatePosition() {
      const menu = menuRef.current;
      const rect = menu?.getBoundingClientRect();
      const width = rect?.width ?? FALLBACK_WIDTH;
      const height = rect?.height ?? FALLBACK_HEIGHT;

      setPosition({
        left: clampCoordinate(x, width, window.innerWidth),
        top: clampCoordinate(y, height, window.innerHeight),
      });
      setMeasured(true);
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [x, y]);

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

  return createPortal(
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{
        left: position.left,
        top: position.top,
        visibility: measured ? 'visible' : 'hidden',
      }}
      onClick={(e) => { e.stopPropagation(); }}
      onKeyDown={handleKeyDown}
      role="menu"
      tabIndex={-1}
    >
      {children}
    </div>,
    document.body,
  );
}
