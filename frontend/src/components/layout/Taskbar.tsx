import { useMemo } from 'react';
import { useWindowManager } from '../../contexts/WindowManager';
import { IconImg } from '../ui/shared';
import styles from './Taskbar.module.css';

export function Taskbar() {
  const { windows, focusWindow, toggleMinimize, closeWindow } = useWindowManager();

  const focusedId = useMemo(() => {
    if (windows.length === 0) return null;
    return windows.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).id;
  }, [windows]);

  const handleClick = (id: string) => {
    const win = windows.find((w) => w.id === id);
    if (!win) return;
    if (win.minimized) {
      focusWindow(id);
    } else if (focusedId === id) {
      toggleMinimize(id);
    } else {
      focusWindow(id);
    }
  };

  if (windows.length === 0) return null;

  return (
    <div className={styles.taskbar} role="toolbar" aria-label="Open windows">
      {windows.map((win) => {
        const isFocused = focusedId === win.id && !win.minimized;
        return (
          <button
            key={win.id}
            className={`${styles.item}${isFocused ? ` ${styles.focused}` : ''}${win.minimized ? ` ${styles.minimized}` : ''}`}
            onClick={() => handleClick(win.id)}
            type="button"
            title={win.title}
            aria-label={`${win.title}${win.minimized ? ' (minimized)' : ''}`}
          >
            <IconImg src={win.icon} alt="" width={18} height={18} />
            <span className={styles.label}>{win.title}</span>
            <span
              className={styles.closeBtn}
              onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
              role="button"
              aria-label={`Close ${win.title}`}
              tabIndex={-1}
            >
              ✕
            </span>
          </button>
        );
      })}
    </div>
  );
}
