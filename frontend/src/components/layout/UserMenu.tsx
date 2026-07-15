import { Icon } from '../ui/Icon';
import { profileAvatarUrl, type Session } from '../../api/client';
import styles from './UserMenu.module.css';

type UserMenuProps = {
  session: Session;
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onClose: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
};

export function UserMenu({
  session,
  open,
  menuRef,
  onToggle,
  onClose,
  onOpenSettings,
  onLogout,
}: UserMenuProps) {
  return (
    <div className={styles.userArea} ref={menuRef}>
      <button
        className={styles.userButton}
        onClick={onToggle}
        type="button"
        aria-label={`User menu for ${session.username}`}
        aria-expanded={open}
      >
        {session.hasAvatar ? (
          <img className={styles.userAvatar} src={profileAvatarUrl(session.avatarVersion)} alt="" />
        ) : (
          <Icon name="avatar-default" size={16} />
        )}
      </button>
      {open && (
        <div className={styles.userDropdown} role="menu">
          <div className={styles.dropdownHeader}>
            {session.hasAvatar ? (
              <img
                className={styles.dropdownAvatar}
                src={profileAvatarUrl(session.avatarVersion)}
                alt=""
              />
            ) : (
              <span className={styles.dropdownAvatarFallback}>
                <Icon name="avatar-default" size={18} />
              </span>
            )}
            <div className={styles.dropdownIdentity}>
              <span className={styles.dropdownUsername}>{session.username}</span>
              {session.role && <span className={styles.dropdownRole}>{session.role}</span>}
            </div>
          </div>
          <div className={styles.dropdownDivider} />
          {onOpenSettings && (
            <button
              type="button"
              className={styles.dropdownItem}
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              role="menuitem"
            >
              <Icon name="preferences-system" size={16} /> Settings
            </button>
          )}
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={() => {
              onClose();
              onLogout?.();
            }}
            role="menuitem"
          >
            <Icon name="system-log-out" size={16} /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}
