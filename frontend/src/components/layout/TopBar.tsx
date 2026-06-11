import { useEffect, useRef, useState } from 'react';
import { AppMenuBar, type AppMenuHandlers } from './AppMenuBar';
import { Icon } from '../ui/Icon';
import type { Session } from '../../api/client';
import appIcon from '../../assets/icon-light.png';
import styles from './TopBar.module.css';

type ActiveView = 'desktop' | 'files' | 'trash' | 'settings' | 'jobs' | 'drives';

type TopBarProps = {
  activeView: ActiveView;
  onGoDesktop: () => void;
  onOpenSettings?: () => void;
  menuHandlers?: AppMenuHandlers;
  title?: string;
  session?: Session | null;
  onLogout?: () => void;
  focusedWindowType?: string | null;
  focusedWindowExists?: boolean;
};

function formatDateTime(date: Date) {
  const weekday = date.toLocaleDateString([], { weekday: 'short' });
  const dayMonth = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${dayMonth}, ${time}`;
}

export function TopBar({ activeView, onGoDesktop, onOpenSettings, menuHandlers, title, session, onLogout, focusedWindowType, focusedWindowExists }: TopBarProps) {
  const [dateTime, setDateTime] = useState(() => formatDateTime(new Date()));
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setDateTime(formatDateTime(new Date()));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  const showUserMenu = session?.authEnabled && session.authenticated;
  const showMenu = ((focusedWindowExists && (focusedWindowType === 'files' || focusedWindowType === 'trash')) || activeView === 'files' || activeView === 'trash') && menuHandlers;
  const appMenuWindowType = !focusedWindowExists ? activeView : (focusedWindowType ?? activeView);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.brand} onClick={onGoDesktop} type="button" title="Go to desktop" aria-label="Go to desktop">
          <img className={styles.brandIcon} src={appIcon} alt="" />
          <span className={styles.brandName}>{title ?? 'Volum Desktop'}</span>
        </button>
        {showMenu && <AppMenuBar handlers={menuHandlers} windowType={appMenuWindowType} />}
      </div>
      <div className={styles.clock}>
        <span>{dateTime}</span>
      </div>
      {showUserMenu && (
        <div className={styles.userArea} ref={menuRef}>
          <button
            className={styles.userButton}
            onClick={() => setUserMenuOpen((v) => !v)}
            type="button"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <Icon name="avatar-default" size={16} />
            <span>{session.username}</span>
            <Icon name="pan-down" size={12} />
          </button>
          {userMenuOpen && (
            <div className={styles.userDropdown} role="menu">
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownUsername}>{session.username}</span>
                {session.role && <span className={styles.dropdownRole}>{session.role}</span>}
              </div>
              <div className={styles.dropdownDivider} />
              {onOpenSettings && (
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => { setUserMenuOpen(false); onOpenSettings(); }}
                  role="menuitem"
                >
                  <Icon name="preferences-system" size={16} /> Settings
                </button>
              )}
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
                role="menuitem"
              >
                <Icon name="system-log-out" size={16} /> Log Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
