import { useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/shared';
import {
  profileAvatarUrl,
  uploadProfileAvatar,
  deleteProfileAvatar,
  type Session,
} from '../../api/client-auth';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsGeneralProps = {
  session: Session | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => Promise<void>;
  onSessionChange: (session: Session) => void;
};

export function SettingsGeneral({
  session,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  onLogout,
  onSessionChange,
}: SettingsGeneralProps) {
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const notifPrefs = useNotificationPreferences();

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file || !session) return;
    setAvatarError(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setAvatarError('Choose a PNG or JPEG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Profile image must be 2 MB or smaller.');
      return;
    }
    setAvatarBusy(true);
    try {
      const avatar = await uploadProfileAvatar(file);
      onSessionChange({ ...session, ...avatar });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Profile image upload failed');
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    if (!session) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const avatar = await deleteProfileAvatar();
      onSessionChange({ ...session, ...avatar });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not remove profile image');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleNotificationChange = async (enabled: boolean) => {
    setNotificationError(null);
    if (!enabled) {
      notifPrefs.setEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined') {
      notifPrefs.setEnabled(false);
      setNotificationError('Browser notifications are not supported here.');
      return;
    }
    if (Notification.permission === 'denied') {
      notifPrefs.setEnabled(false);
      setNotificationError('Notifications are blocked in your browser settings.');
      return;
    }
    setNotificationBusy(true);
    try {
      const permission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      notifPrefs.setEnabled(permission === 'granted');
      if (permission !== 'granted') {
        setNotificationError('Notification permission was not granted.');
      }
    } catch {
      notifPrefs.setEnabled(false);
      setNotificationError('The browser could not enable notifications.');
    } finally {
      setNotificationBusy(false);
    }
  };

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await onLogout();
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Could not log out');
    } finally {
      setLogoutBusy(false);
    }
  };

  return (
    <section className={styles.settingsSection}>
      <h4>General</h4>
      <div className={styles.generalSections}>
        {session?.authEnabled && (
          <div className={styles.generalGroup}>
            <h5>Profile</h5>
            <div className={styles.profileImageRow}>
              {session.hasAvatar ? (
                <img
                  className={styles.profileImage}
                  src={profileAvatarUrl(session.avatarVersion)}
                  alt="Current profile"
                />
              ) : (
                <span className={styles.profileImageFallback}>
                  <Icon name="avatar-default" size={24} />
                </span>
              )}
              <div className={styles.profileImageDetails}>
                <strong>Profile image</strong>
                <span>PNG or JPEG, up to 2 MB</span>
              </div>
              <input
                ref={avatarInputRef}
                className={styles.avatarInput}
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
              />
              <div className={styles.profileImageActions}>
                <Button
                  size="compact"
                  disabled={avatarBusy}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarBusy ? 'Saving...' : session.hasAvatar ? 'Replace' : 'Upload'}
                </Button>
                {session.hasAvatar && (
                  <Button
                    size="compact"
                    disabled={avatarBusy}
                    onClick={() => void handleAvatarDelete()}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {avatarError && (
              <p className={styles.avatarError} role="alert">
                {avatarError}
              </p>
            )}
          </div>
        )}

        <div className={styles.generalGroup}>
          <h5>Appearance</h5>
          <div className={styles.settingsActions}>
            <Button size="compact" onClick={onToggleTheme}>
              {theme === 'light' ? 'Use Dark Theme' : 'Use Light Theme'}
            </Button>
            <Button size="compact" onClick={onOpenShortcuts}>
              Keyboard Shortcuts
            </Button>
          </div>
        </div>

        <div className={styles.generalGroup}>
          <h5>Notifications</h5>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={notifPrefs.enabled}
              disabled={notificationBusy}
              onChange={(e) => void handleNotificationChange(e.target.checked)}
            />
            <span>Browser notifications</span>
          </label>
          {notificationError && (
            <p className={styles.notificationError} role="alert">
              {notificationError}
            </p>
          )}
        </div>

        {session?.authEnabled && (
          <div className={styles.generalGroup}>
            <h5>Session</h5>
            <div className={styles.settingsActions}>
              <Button size="compact" disabled={logoutBusy} onClick={() => void handleLogout()}>
                {logoutBusy ? 'Logging out…' : 'Log Out'}
              </Button>
            </div>
            {logoutError && (
              <p className={styles.maintenanceError} role="alert">
                {logoutError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
