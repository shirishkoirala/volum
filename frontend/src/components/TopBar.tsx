import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { Session } from '../api/client';
import appIcon from '../assets/icon-light.png';
import styles from './TopBar.module.css';

type ActiveView = 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';

type TopBarProps = {
  activeView: ActiveView;
  onGoDesktop: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onOpenShortcuts: () => void;
  session: Session | null;
};

export function TopBar({ activeView, onGoDesktop, theme, onToggleTheme, onOpenSettings, onLogout, onOpenShortcuts, session }: TopBarProps) {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const systemMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showSystemMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (systemMenuRef.current && !systemMenuRef.current.contains(e.target as Node)) {
        setShowSystemMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSystemMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSystemMenu]);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.brand} onClick={onGoDesktop} type="button" title="Go to desktop" aria-label="Go to desktop">
          <img className={styles.brandIcon} src={appIcon} alt="" />
          <span className={styles.brandName}>Volum Desktop</span>
        </button>
      </div>
      <div className={styles.center}>
        <span className={styles.clock}>{clock}</span>
      </div>
      <div className={styles.right}>
        <button className={styles.systemBtn} onClick={onToggleTheme} type="button" title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} aria-label="Toggle theme">
          <Icon name={theme === 'light' ? 'weather-clear-night' : 'weather-clear'} size={16} />
        </button>
        <button className={styles.systemBtn} onClick={() => setShowSystemMenu(v => !v)} type="button" title="System menu" aria-label="System menu">
          <Icon name="preferences-system" size={16} />
        </button>
        {showSystemMenu && (
          <div className={styles.systemMenu} ref={systemMenuRef} role="menu">
            <button className={styles.systemMenuItem} onClick={() => { onToggleTheme(); setShowSystemMenu(false); }} role="menuitem" type="button">
              <Icon name={theme === 'light' ? 'weather-clear-night' : 'weather-clear'} size={16} />
              {theme === 'light' ? 'Dark Theme' : 'Light Theme'}
            </button>
            <button className={styles.systemMenuItem} onClick={() => { onOpenShortcuts(); setShowSystemMenu(false); }} role="menuitem" type="button">
              <Icon name="dialog-information" size={16} />
              Keyboard Shortcuts
            </button>
            <div className={styles.systemMenuSeparator} role="separator" />
            <button className={styles.systemMenuItem} onClick={() => { onOpenSettings(); setShowSystemMenu(false); }} role="menuitem" type="button">
              <Icon name="preferences-system" size={16} />
              Settings
            </button>
            {session?.authEnabled && (
              <button className={styles.systemMenuItem} onClick={() => { onLogout(); setShowSystemMenu(false); }} role="menuitem" type="button">
                <Icon name="system-log-out" size={16} />
                Log Out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
