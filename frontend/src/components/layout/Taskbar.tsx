import { useMemo } from 'react';
import { useWindowManager } from '../../contexts/WindowManager';
import { Icon } from '../ui/Icon';
import { IconImg } from '../ui/shared';
import styles from './Taskbar.module.css';

export type LauncherItem = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
};

type TaskbarProps = {
  launcherItems: LauncherItem[];
  onActivateLauncher: (id: string) => void;
};

export function Taskbar({ launcherItems, onActivateLauncher }: TaskbarProps) {
  const { windows, focusWindow, toggleMinimize, closeWindow } = useWindowManager();
  const launcherIds = useMemo(() => new Set(launcherItems.map((item) => item.id)), [launcherItems]);
  const visibleWindowItems = useMemo(
    () => windows.filter((win) => !launcherIds.has(win.id.split('-')[0] ?? win.id)),
    [launcherIds, windows],
  );

  const focusedId = useMemo(() => {
    if (windows.length === 0) return null;
    return windows.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).id;
  }, [windows]);

  const handleWindowClick = (id: string) => {
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

  const isLauncherOpen = (id: string) => windows.some((w) => w.id.startsWith(`${id}-`));
  const isLauncherFocused = (id: string) => {
    if (!focusedId) return false;
    return focusedId.startsWith(`${id}-`);
  };

  return (
    <div className={styles.taskbar} role="toolbar" aria-label="Taskbar">
      {launcherItems.map((item) => {
        const open = isLauncherOpen(item.id);
        const focused = isLauncherFocused(item.id);
        return (
          <button
            key={item.id}
            className={`${styles.launcher}${open ? ` ${styles.hasWindow}` : ''}${focused ? ` ${styles.focused}` : ''}`}
            onClick={() => onActivateLauncher(item.id)}
            type="button"
            title={item.label}
            aria-label={item.label}
          >
            <IconImg src={item.icon} alt="" width={22} height={22} />
            {item.badge != null && item.badge > 0 && (
              <span className={styles.badge}>{item.badge}</span>
            )}
          </button>
        );
      })}

      {visibleWindowItems.length > 0 && <div className={styles.divider} />}

      {visibleWindowItems.map((win) => {
        const isFocused = focusedId === win.id && !win.minimized;
        return (
          <button
            key={win.id}
            className={`${styles.item}${isFocused ? ` ${styles.focused}` : ''}${win.minimized ? ` ${styles.minimized}` : ''}`}
            onClick={() => handleWindowClick(win.id)}
            type="button"
            title={win.title}
            aria-label={`${win.title}${win.minimized ? ' (minimized)' : ''}`}
          >
            <IconImg src={win.icon} alt="" width={18} height={18} />
            <span className={styles.label}>{win.title}</span>
            <span
              className={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(win.id);
              }}
              role="button"
              aria-label={`Close ${win.title}`}
              tabIndex={-1}
            >
              <Icon name="window-close" size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
