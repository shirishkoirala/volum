import {
  createContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useContext,
  type ButtonHTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
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
const ContextMenuCloseContext = createContext<(() => void) | null>(null);

interface ContextMenuItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'onClick' | 'type'
> {
  icon: string;
  onSelect: () => void;
  danger?: boolean;
  children: ReactNode;
}

export function ContextMenuItem({
  icon,
  onSelect,
  danger = false,
  className,
  children,
  ...buttonProps
}: ContextMenuItemProps) {
  const onClose = useContext(ContextMenuCloseContext);

  return (
    <button
      {...buttonProps}
      type="button"
      className={[danger ? styles.danger : '', className].filter(Boolean).join(' ')}
      onClick={() => {
        onSelect();
        onClose?.();
      }}
      role="menuitem"
    >
      <Icon name={icon} size={16} /> {children}
    </button>
  );
}

function clampCoordinate(value: number, size: number, viewportSize: number) {
  return Math.max(VIEWPORT_GAP, Math.min(value, viewportSize - size - VIEWPORT_GAP));
}

export function ContextMenuShell({ x, y, onClose, children }: ContextMenuShellProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [position, setPosition] = useState(() => ({
    left: clampCoordinate(x, FALLBACK_WIDTH, window.innerWidth),
    top: clampCoordinate(y, FALLBACK_HEIGHT, window.innerHeight),
  }));
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const menu = menuRef.current;
    const returnFocus = returnFocusRef.current;
    (menu?.querySelector<HTMLButtonElement>('button:not([disabled])') ?? menu)?.focus();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
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
    if (e.key === 'Tab') {
      onClose();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons || buttons.length === 0) return;
      const current = document.activeElement;
      const idx = Array.from(buttons).indexOf(current as HTMLButtonElement);
      const next =
        e.key === 'ArrowDown'
          ? (idx + 1) % buttons.length
          : (idx - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus();
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons || buttons.length === 0) return;
      buttons[e.key === 'Home' ? 0 : buttons.length - 1]?.focus();
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
      onClick={(e) => {
        e.stopPropagation();
      }}
      onKeyDown={handleKeyDown}
      role="menu"
      tabIndex={-1}
    >
      <ContextMenuCloseContext value={onClose}>{children}</ContextMenuCloseContext>
    </div>,
    document.body,
  );
}
