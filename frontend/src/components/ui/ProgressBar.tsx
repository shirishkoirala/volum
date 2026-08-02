import styles from './ProgressBar.module.css';

type ProgressBarProps = {
  value: number;
  className?: string;
  ariaLabel?: string;
  compact?: boolean;
};

export function ProgressBar({ value, className, ariaLabel, compact = false }: ProgressBarProps) {
  return (
    <span
      className={`${styles.track}${compact ? ` ${styles.compact}` : ''}${
        className ? ` ${className}` : ''
      }`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <span
        className={styles.fill}
        style={{ '--progress': `${Math.min(value, 100)}%` } as React.CSSProperties}
      />
    </span>
  );
}
