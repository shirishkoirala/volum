import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type NotificationPreferences = {
  enabled: boolean;
};

const notificationPreferenceEvent = 'volum:notification-preferences';

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useLocalStorage<NotificationPreferences>('volum_notifications', {
    enabled: false,
  });

  useEffect(() => {
    const syncPreferences = (event: Event) => {
      setPrefs((event as CustomEvent<NotificationPreferences>).detail);
    };
    window.addEventListener(notificationPreferenceEvent, syncPreferences);
    return () => window.removeEventListener(notificationPreferenceEvent, syncPreferences);
  }, [setPrefs]);

  const setEnabled = (enabled: boolean) => {
    const next = { enabled };
    setPrefs(next);
    window.dispatchEvent(new CustomEvent(notificationPreferenceEvent, { detail: next }));
  };

  return { ...prefs, setEnabled };
}
