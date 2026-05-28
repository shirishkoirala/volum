import { useEffect, useState } from 'react';
import { AppMenuBar, type AppMenuHandlers } from './AppMenuBar';
import appIcon from '../../assets/icon-light.png';
import styles from './TopBar.module.css';

type ActiveView = 'desktop' | 'files' | 'trash' | 'settings' | 'jobs';

type TopBarProps = {
  activeView: ActiveView;
  onGoDesktop: () => void;
  menuHandlers?: AppMenuHandlers;
  title?: string;
};

function formatDateTime(date: Date) {
  const weekday = date.toLocaleDateString([], { weekday: 'short' });
  const dayMonth = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${dayMonth}, ${time}`;
}

export function TopBar({ activeView, onGoDesktop, menuHandlers, title }: TopBarProps) {
  const [dateTime, setDateTime] = useState(() => formatDateTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      setDateTime(formatDateTime(new Date()));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.brand} onClick={onGoDesktop} type="button" title="Go to desktop" aria-label="Go to desktop">
          <img className={styles.brandIcon} src={appIcon} alt="" />
          <span className={styles.brandName}>{title ?? 'Volum Desktop'}</span>
        </button>
        {activeView === 'files' && menuHandlers && <AppMenuBar handlers={menuHandlers} />}
      </div>
      <div className={styles.center}>
        <span className={styles.clock}>{dateTime}</span>
      </div>
    </header>
  );
}
