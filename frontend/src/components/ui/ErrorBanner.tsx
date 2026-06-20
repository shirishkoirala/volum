import { Icon } from './Icon';
import styles from './ErrorBanner.module.css';

type ErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
};

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className={styles.errorBanner}>
      <Icon name="alert-triangle" size={16} />
      <span className={styles.errorText}>{message}</span>
      <div className={styles.errorActions}>
        {onRetry && (
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            <Icon name="view-refresh" size={14} /> Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className={styles.dismissBtn} onClick={onDismiss} aria-label="Dismiss error">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
