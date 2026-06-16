import { IconImg } from '../ui/shared';
import styles from './Dock.module.css';

type DockItem = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  active: boolean;
};

type DockProps = {
  items: DockItem[];
  onActivate: (id: string) => void;
  shellStatusVisible?: boolean;
};

export function Dock({ items, onActivate, shellStatusVisible = false }: DockProps) {
  return (
    <aside className={`${styles.dock}${shellStatusVisible ? ` ${styles.withShellStatus}` : ''}`} role="navigation" aria-label="App dock">
      {items.map((item) => (
        <button
          key={item.id}
          className={`${styles.dockItem}${item.active ? ` ${styles.active}` : ''}`}
          onClick={() => onActivate(item.id)}
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
        >
          <IconImg src={item.icon} alt="" width={24} height={24} />
          {item.badge != null && item.badge > 0 && (
            <span className={styles.dockBadge} aria-label={`${item.badge} ${item.label.toLowerCase()} items`}>
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </aside>
  );
}
