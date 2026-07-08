import { useCallback, useState } from 'react';
import type { Toast } from '../components/overlay/Toast';

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const showToastObj = useCallback(
    (toast: Omit<Toast, 'id'>, timeout = 4000) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((items) => [...items.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), timeout);
    },
    [dismissToast],
  );

  const showToast = useCallback(
    (title: string, variant?: Toast['variant'], message?: string) => {
      showToastObj({ title, variant: variant ?? 'success', message });
    },
    [showToastObj],
  );

  return {
    toasts,
    dismissToast,
    showToast,
    showToastObj,
  };
}
