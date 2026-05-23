import { IconImg } from './shared';
import styles from './EmptyState.module.css';

type EmptyStateProps = {
  icon: string;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className={styles.emptyState} role="status" aria-live="polite">
      <IconImg src={icon} alt="" width={64} height={64} className={styles.icon} />
      <span className={styles.title}>{title}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
  );
}
