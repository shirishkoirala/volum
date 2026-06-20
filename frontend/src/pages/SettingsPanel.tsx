import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Button, MutedText } from '../components/ui/shared';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ServerInfo } from '../components/ui/ServerInfo';
import { formatBytes } from '../utils/format';
import {
  getStatus,
  dbVacuum,
  dbPruneJobs,
  dbPruneAuditLogs,
  listUsers,
  createUser,
  deleteUser,
  changePassword,
  changeRole,
  deleteProfileAvatar,
  profileAvatarUrl,
  uploadProfileAvatar,
  type StatusResponse,
  type RootEntry,
  type Session,
  type UserInfo,
} from '../api/client';
import type { ServiceShortcut, ServiceHealthResult } from '../utils/services';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import styles from './SettingsPanel.module.css';

type SettingsPanelProps = {
  onOpenShares?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  session: Session | null;
  onSessionChange: (session: Session) => void;
  services?: ServiceShortcut[];
  serviceHealth?: Record<string, ServiceHealthResult>;
  onAddService?: () => void;
  onEditService?: (id: string) => void;
  onRemoveService?: (id: string) => void;
  onReorderServices?: (ids: string[]) => Promise<void>;
};

type CategoryId = 'general' | 'server' | 'storage' | 'desktop' | 'admin' | 'about';

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'preferences-system' },
  { id: 'server', label: 'Server', icon: 'dialog-information' },
  { id: 'storage', label: 'Storage', icon: 'drive-harddisk' },
  { id: 'desktop', label: 'Desktop', icon: 'monitor' },
  { id: 'admin', label: 'Administration', icon: 'preferences-system' },
  { id: 'about', label: 'About', icon: 'help-about' },
];

export function SettingsPanel({
  onOpenShares,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  onLogout,
  session,
  onSessionChange,
  services,
  serviceHealth,
  onAddService,
  onEditService,
  onRemoveService,
  onReorderServices,
}: SettingsPanelProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
  const [filterQuery, setFilterQuery] = useState('');

  const [users, setUsers] = useState<UserInfo[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'readonly'>('readonly');
  const [creatingUser, setCreatingUser] = useState(false);
  const [pwdChangeUserId, setPwdChangeUserId] = useState<string | null>(null);
  const notifPrefs = useNotificationPreferences();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [pwdChangeValue, setPwdChangeValue] = useState('');
  const [userMsg, setUserMsg] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const loadStatus = useCallback(() => {
    setLoading(true);
    getStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    listUsers()
      .then(setUsers)
      .catch((err) => setUsersError(err.message))
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    if (activeCategory === 'admin' && session?.role === 'admin') {
      loadUsers();
    }
  }, [activeCategory, loadUsers, session]);

  const handleCreateUser = async () => {
    setCreatingUser(true);
    setUserError(null);
    setUserMsg(null);
    try {
      await createUser(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setNewRole('readonly');
      setUserMsg(`User "${newUsername}" created.`);
      loadUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    setUserError(null);
    setUserMsg(null);
    try {
      await deleteUser(userId);
      setUserMsg(`User "${username}" deleted.`);
      loadUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleChangePassword = async (userId: string) => {
    setUserError(null);
    setUserMsg(null);
    try {
      await changePassword(userId, pwdChangeValue);
      setPwdChangeUserId(null);
      setPwdChangeValue('');
      setUserMsg('Password updated.');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const handleChangeRole = async (userId: string, role: 'admin' | 'readonly') => {
    setUserError(null);
    setUserMsg(null);
    try {
      await changeRole(userId, role);
      setUserMsg('Role updated.');
      loadUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  const handleVacuum = async () => {
    setMaintenanceBusy('vacuum');
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      await dbVacuum();
      setMaintenanceMsg('Database vacuum completed.');
      loadStatus();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Vacuum failed');
    } finally {
      setMaintenanceBusy(null);
    }
  };

  const handlePruneJobs = async () => {
    setMaintenanceBusy('pruneJobs');
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      const result = await dbPruneJobs();
      setMaintenanceMsg(`Pruned ${result.removed} old transfer records.`);
      loadStatus();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Prune failed');
    } finally {
      setMaintenanceBusy(null);
    }
  };

  const handlePruneAuditLogs = async () => {
    setMaintenanceBusy('pruneAudit');
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      const result = await dbPruneAuditLogs();
      setMaintenanceMsg(`Pruned ${result.removed} old audit log entries.`);
      loadStatus();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Prune failed');
    } finally {
      setMaintenanceBusy(null);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!filterQuery.trim()) return CATEGORIES;
    const q = filterQuery.toLowerCase();
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [filterQuery]);

  const hasUnavailableRoot = status?.roots.some((r) => !r.available);

  const content = (
    <>
      {loading && !status ? (
        <div className={styles.settingsSkeleton}>
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={`${styles.skeletonBlock} ${styles.short}`} />
        </div>
      ) : !status ? (
        <p><MutedText>Failed to load status. <Button variant="link" onClick={loadStatus}>Retry</Button></MutedText></p>
      ) : (
        <>
          {(!filterQuery.trim() ? activeCategory === 'general' : filteredCategories.some((c) => c.id === 'general')) && (
            <section className={styles.settingsSection}>
              <h4>General</h4>
              {session?.authEnabled && (
                <div className={styles.profileImageRow}>
                  {session.hasAvatar ? (
                    <img className={styles.profileImage} src={profileAvatarUrl(session.avatarVersion)} alt="Current profile" />
                  ) : (
                    <span className={styles.profileImageFallback}><Icon name="avatar-default" size={24} /></span>
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
                    <Button size="compact" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
                      {avatarBusy ? 'Saving...' : session.hasAvatar ? 'Replace' : 'Upload'}
                    </Button>
                    {session.hasAvatar && (
                      <Button size="compact" disabled={avatarBusy} onClick={() => void handleAvatarDelete()}>Remove</Button>
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
                      if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
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
          )}

          {(!filterQuery.trim() ? activeCategory === 'server' : filteredCategories.some((c) => c.id === 'server')) && (
            <div className={styles.settingsSection}>
              <ServerInfo status={status} />
            </div>
          )}

          {(!filterQuery.trim() ? activeCategory === 'storage' : filteredCategories.some((c) => c.id === 'storage')) && (
            <section className={styles.settingsSection}>
              <h4>
                Roots
                {hasUnavailableRoot ? (
                  <span className={styles.rootWarningBadge}>
                    <Icon name="dialog-warning" size={13} />
                    Some unavailable
                  </span>
                ) : null}
              </h4>
              <div className={styles.settingsRootList}>
                {status.roots.map((root) => (
                  <div key={root.path} className={`${styles.settingsRootItem}${!root.available ? ` ${styles.rootUnavailable}` : ''}`}>
                    <div className={styles.settingsRootName}>
                      <span>{rootLabel(root)}</span>
                      <small>{root.path}</small>
                    </div>
{root.available && root.totalBytes > 0 && (
  <ProgressBar value={Math.min((root.usedBytes / root.totalBytes) * 100, 100)} className={styles.rootMeter} />
)}
                    <small>{root.available ? formatRootUsage(root) : 'Unavailable — check mount or configuration'}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(!filterQuery.trim() ? activeCategory === 'desktop' : filteredCategories.some((c) => c.id === 'desktop')) && (
            <>
              {onAddService && (
                <section className={styles.settingsSection}>
                  <h4>Services</h4>
                  {services && services.length > 0 ? (
                    <div className={styles.serviceList}>
                      {services.map((svc, idx) => (
                        <div
                          key={svc.id}
                          className={`${styles.serviceRow}${dragIndex === idx ? ` ${styles.dragging}` : ''}${dropIndex === idx ? ` ${styles.dragOver}` : ''}`}
                          draggable
                          onDragStart={() => { setDragIndex(idx); dragOverIndex.current = null; }}
                          onDragEnd={() => {
                            const toIdx = dragOverIndex.current;
                            const fromIdx = dragIndex;
                            if (toIdx !== null && fromIdx !== null && toIdx !== fromIdx) {
                              const ids = [...services.map(s => s.id)];
                              const moved = ids[fromIdx];
                              if (!moved) return;
                              ids.splice(fromIdx, 1);
                              ids.splice(toIdx, 0, moved);
                              onReorderServices?.(ids);
                            }
                            setDragIndex(null);
                            setDropIndex(null);
                            dragOverIndex.current = null;
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dropIndex !== idx) setDropIndex(idx);
                            dragOverIndex.current = idx;
                          }}
                          onDragLeave={() => { setDropIndex(null); }}
                        >
                          <div className={styles.serviceDragHandle}>
                            <Icon name="drag-handle" size={14} />
                          </div>
                          <div className={styles.serviceInfo}>
                            <span>{svc.name}</span>
                            <span className={styles.serviceHealth}>
                              {(() => {
                                const h = serviceHealth?.[svc.id];
                                if (!h) return '⋯';
                                return h.status === 'healthy'
                                  ? '✓ Healthy'
                                  : h.status === 'unhealthy'
                                    ? '✗ Unhealthy'
                                    : '⋯ Checking';
                              })()}
                            </span>
                          </div>
                          <div className={styles.serviceActions}>
                            <Button size="compact" onClick={() => onEditService?.(svc.id)}>Edit</Button>
                            <Button size="compact" onClick={() => onRemoveService?.(svc.id)}>Remove</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <MutedText compact>No services configured. Add shortcuts to your favorite web apps.</MutedText>
                  )}
                  <div className={styles.settingsActions}>
                    <Button size="compact" onClick={onAddService}>Add Service</Button>
                  </div>
                </section>
              )}
            </>
          )}

          {(!filterQuery.trim() ? activeCategory === 'admin' : filteredCategories.some((c) => c.id === 'admin')) && (
            <>
              <section className={styles.settingsSection}>
                <h4>Maintenance</h4>
                <div className={styles.maintenanceActions}>
                  <Button size="compact" onClick={handleVacuum} disabled={maintenanceBusy !== null}>
                    {maintenanceBusy === 'vacuum' && <Icon name="view-refresh" size={12} className={styles.spin} />}
                    Vacuum DB
                  </Button>
                  <Button size="compact" onClick={handlePruneJobs} disabled={maintenanceBusy !== null}>
                    {maintenanceBusy === 'pruneJobs' && <Icon name="view-refresh" size={12} className={styles.spin} />}
                    Prune Old Transfers
                  </Button>
                  <Button size="compact" onClick={handlePruneAuditLogs} disabled={maintenanceBusy !== null}>
                    {maintenanceBusy === 'pruneAudit' && <Icon name="view-refresh" size={12} className={styles.spin} />}
                    Prune Audit Logs
                  </Button>
                </div>
                {maintenanceMsg && <p className={styles.maintenanceMsg}>{maintenanceMsg}</p>}
                {maintenanceError && <p className={styles.maintenanceError}>{maintenanceError}</p>}
              </section>

              <section className={styles.settingsSection}>
                <h4>Transfers</h4>
                <dl className={styles.settingsDetails}>
                  <dt>Active</dt>
                  <dd>{status.jobCounts.active}</dd>
                  <dt>Completed</dt>
                  <dd>{status.jobCounts.completed}</dd>
                  <dt>Failed</dt>
                  <dd>{status.jobCounts.failed}</dd>
                </dl>
              </section>

              {session?.role === 'admin' && (
                <section className={styles.settingsSection}>
                  <h4>Users</h4>
                  {(users === null && !usersLoading) && (
                    <Button size="compact" onClick={loadUsers}>
                      Load Users
                    </Button>
                  )}
                  {usersLoading && <MutedText>Loading...</MutedText>}
                  {usersError && (
                    <p><MutedText>Error: {usersError}. <Button variant="link" onClick={loadUsers}>Retry</Button></MutedText></p>
                  )}
                  {users && (
                    <div className={styles.userList}>
                      {users.length === 0 ? (
                        <MutedText compact>No users found.</MutedText>
                      ) : (
                        users.map((u) => (
                          <div key={u.id} className={styles.userRow}>
                            <div className={styles.userInfo}>
                              <span>{u.username}</span>
                              <span className={styles.userRole}>{u.role}</span>
                            </div>
                            {u.id !== session?.userId && (
                              <div className={styles.userActions}>
                                {pwdChangeUserId === u.id ? (
                                  <span className={styles.pwdInline}>
                                    <input
                                      type="password"
                                      placeholder="New password"
                                      value={pwdChangeValue}
                                      onChange={(e) => setPwdChangeValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(u.id); if (e.key === 'Escape') { setPwdChangeUserId(null); setPwdChangeValue(''); } }}
                                      autoFocus
                                    />
                                    <Button size="compact" disabled={!pwdChangeValue} onClick={() => handleChangePassword(u.id)}>Set</Button>
                                    <Button size="compact" onClick={() => { setPwdChangeUserId(null); setPwdChangeValue(''); }}>Cancel</Button>
                                  </span>
                                ) : (
                                  <>
                                    <Button size="compact" onClick={() => { setPwdChangeUserId(u.id); setPwdChangeValue(''); }}>Password</Button>
                                    <Button size="compact" onClick={() => handleChangeRole(u.id, u.role === 'admin' ? 'readonly' : 'admin')}>
                                      Make {u.role === 'admin' ? 'readonly' : 'admin'}
                                    </Button>
                                    <Button size="compact" onClick={() => handleDeleteUser(u.id, u.username)}>Delete</Button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <details className={styles.createUserDetails}>
                    <summary>Create new user</summary>
                    <div className={styles.createUserForm}>
                      <input
                        placeholder="Username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'readonly')}>
                        <option value="readonly">Readonly</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button
                        size="compact"
                        disabled={creatingUser || !newUsername || !newPassword}
                        onClick={handleCreateUser}
                      >
                        {creatingUser ? <><Icon name="view-refresh" size={12} className={styles.spin} /> Creating...</> : 'Create'}
                      </Button>
                    </div>
                  </details>
                  {userMsg && <p className={styles.maintenanceMsg}>{userMsg}</p>}
                  {userError && <p className={styles.maintenanceError}>{userError}</p>}
                </section>
              )}

              {onOpenShares && (
                <section className={styles.settingsSection}>
                  <h4>Shares</h4>
                  <p><MutedText compact>Manage expiring share links for files and folders.</MutedText></p>
                  <div className={styles.sharesActions}>
                    <Button size="compact" onClick={onOpenShares}>
                      Manage Shares
                    </Button>
                  </div>
                </section>
              )}
            </>
          )}

          {(!filterQuery.trim() ? activeCategory === 'about' : filteredCategories.some((c) => c.id === 'about')) && (
            <section className={styles.settingsSection}>
              <h4>About</h4>
              <dl className={styles.settingsDetails}>
                <dt>Version</dt>
                <dd>{status.version}</dd>
                <dt>Build</dt>
                <dd>{status.buildTime || 'Unknown'}</dd>
                <dt>Runtime</dt>
                <dd>{status.goVersion}</dd>
              </dl>
            </section>
          )}

          {filterQuery.trim() && filteredCategories.length === 0 && (
            <div className={styles.settingsSection}>
              <EmptyState compact title="No matching settings" subtitle={`Nothing found for "${filterQuery}"`} />
            </div>
          )}
        </>
      )}
    </>
  );

  const sidebarNav = (
    <nav className={styles.settingsNav} aria-label="Settings categories">
      <input
        type="text"
        className={styles.settingsFilter}
        placeholder="Search settings..."
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
      />
      <ul className={styles.settingsNavList}>
        {(filterQuery.trim() ? filteredCategories : CATEGORIES).map((cat) => (
          <li key={cat.id}>
            <button
              className={`${styles.settingsNavItem}${activeCategory === cat.id ? ` ${styles.active}` : ''}`}
              onClick={() => { setActiveCategory(cat.id); setFilterQuery(''); }}
              aria-current={activeCategory === cat.id ? 'true' : undefined}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className={styles.settingsBodyPage}>
      {sidebarNav}
      <div className={styles.settingsContent}>
        {content}
      </div>
    </div>
  );
}



function formatRootUsage(root: RootEntry) {
  if (!root.available) return 'Unavailable';
  if (root.totalBytes <= 0) return 'Usage unavailable';
  const fsType = root.fsType ? ` · ${root.fsType}` : '';
  return `${formatBytes(root.usedBytes)} used of ${formatBytes(root.totalBytes)} | ${formatBytes(root.freeBytes)} free${fsType}`;
}

function rootLabel(root: RootEntry) {
  if (root.label) return root.label;
  if (root.path === '/') return 'Server root';
  return root.path.split('/').filter(Boolean).pop() || root.path;
}
