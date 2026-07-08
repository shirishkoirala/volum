import { useLocalStorage } from './useLocalStorage';

export type NotificationPreferences = {
  enabled: boolean;
};

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useLocalStorage<NotificationPreferences>('volum_notifications', {
    enabled: true,
  });

  const setEnabled = (enabled: boolean) => {
    setPrefs({ enabled });
  };

  return { ...prefs, setEnabled };
}
