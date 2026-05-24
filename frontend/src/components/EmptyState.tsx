import type { ReactNode } from 'react';
import { IconImg } from './shared';
import { emptyIconUrl } from '../api/icons';
import styles from './EmptyState.module.css';

type EmptyStateProps = {
  icon?: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
  children?: ReactNode;
};

export function EmptyState({ icon, title, subtitle, compact, children }: EmptyStateProps) {
  return (
    <div className={`${styles.emptyState}${compact ? ` ${styles.compact}` : ''}`} role="status" aria-live="polite">
      <IconImg src={icon || emptyIconUrl()} alt="" width={compact ? 48 : 64} height={compact ? 48 : 64} className={styles.icon} />
      <span className={styles.title}>{title}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      {children && <div className={styles.extra}>{children}</div>}
    </div>
  );
}
