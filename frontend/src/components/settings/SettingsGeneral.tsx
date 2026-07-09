import { useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/shared';
import {
  profileAvatarUrl,
  uploadProfileAvatar,
  deleteProfileAvatar,
  type Session,
} from '../../api/client';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsGeneralProps = {
  session: Session | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
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

  return (
    <section className={styles.settingsSection}>
      <h4>General</h4>
      {session?.authEnabled && (
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
      )}
      {avatarError && <p className={styles.avatarError}>{avatarError}</p>}
      <div className={styles.settingsActions}>
        <Button size="compact" onClick={onToggleTheme}>
          {theme === 'light' ? 'Use Dark Theme' : 'Use Light Theme'}
        </Button>
        <Button size="compact" onClick={onOpenShortcuts}>
          Keyboard Shortcuts
        </Button>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={notifPrefs.enabled}
            onChange={(e) => {
              notifPrefs.setEnabled(e.target.checked);
              if (
                e.target.checked &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'default'
              ) {
                void Notification.requestPermission();
              }
            }}
          />
          <span>Browser notifications</span>
        </label>
        {session?.authEnabled && (
          <Button size="compact" onClick={onLogout}>
            Log Out
          </Button>
        )}
      </div>
    </section>
  );
}
