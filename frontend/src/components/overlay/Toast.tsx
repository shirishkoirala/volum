import { useState } from 'react';
import { Icon } from '../ui/Icon';
import styles from './Toast.module.css';

export type Toast = {
  id: number;
  title: string;
  message?: string;
  variant: 'success' | 'error' | 'warning';
  action?: { label: string; onClick: () => void };
};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const [exitingIds, setExitingIds] = useState(new Set<number>());

  const variantClass = (variant: Toast['variant']) => {
    if (variant === 'success') return styles.toastSuccess;
    if (variant === 'warning') return styles.toastWarning;
    return styles.toastError;
  };

  const handleDismiss = (id: number) => {
    setExitingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onDismiss(id);
    }, 300);
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          className={`${styles.toast} ${variantClass(toast.variant)}${exitingIds.has(toast.id) ? ` ${styles.toastExiting}` : ''}`}
          key={toast.id}
        >
          <div className={styles.toastContent}>
            <strong>{toast.title}</strong>
            {toast.message && <span>{toast.message}</span>}
          </div>
          <div className={styles.toastActions}>
            {toast.action && (
              <button
                type="button"
                className={styles.toastActionBtn}
                onClick={() => {
                  toast.action!.onClick();
                  handleDismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="window-close" size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
