import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './BreadcrumbBar.module.css';

export type Crumb = {
  label: string;
  path?: string;
};

type BreadcrumbBarProps = {
  crumbs: Crumb[];
  onBack: () => void;
  onNavigate: (path: string) => void;
  children?: ReactNode;
};

export function BreadcrumbBar({ crumbs, onBack, onNavigate, children }: BreadcrumbBarProps) {
  if (crumbs.length === 0) {
    return null;
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className="icon-button"
          onClick={onBack}
          title="Go back"
          type="button"
        >
          <span className="icon-rotate-180"><Icon name="go-next" size={18} /></span>
        </button>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <span key={index} className={styles.crumbRow}>
                {index > 0 && <Icon name="go-next" size={16} />}
                {isLast && !crumb.path ? (
                  <span className={styles.current}>{crumb.label}</span>
                ) : crumb.path ? (
                  <button type="button" onClick={() => onNavigate(crumb.path!)} className={styles.crumbBtn}>
                    {crumb.label}
                  </button>
                ) : (
                  <span className={styles.current}>{crumb.label}</span>
                )}
              </span>
            );
          })}
        </nav>
      </div>
      {children && <div className={styles.right}>{children}</div>}
    </header>
  );
}
