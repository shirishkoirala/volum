import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Button, MutedText } from '../components/ui/shared';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ServerInfo } from '../components/ui/ServerInfo';
import { WallpaperPicker } from '../components/ui/WallpaperPicker';
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
  type StatusResponse,
  type RootEntry,
  type Session,
  type UserInfo,
} from '../api/client';
import type { WallpaperConfig } from '../utils/wallpaper';
import styles from './SettingsPanel.module.css';

type SettingsPanelProps = {
  onOpenShares?: () => void;
  wallpaper?: WallpaperConfig;
  onWallpaperChange?: (config: WallpaperConfig) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  session: Session | null;
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
  wallpaper,
  onWallpaperChange,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  onLogout,
  session,
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
  const [pwdChangeValue, setPwdChangeValue] = useState('');
  const [userMsg, setUserMsg] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

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
              <div className={styles.settingsActions}>
                <Button size="compact" onClick={onToggleTheme}>
                  {theme === 'light' ? 'Use Dark Theme' : 'Use Light Theme'}
                </Button>
                <Button size="compact" onClick={onOpenShortcuts}>
                  Keyboard Shortcuts
                </Button>
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

          {(!filterQuery.trim() ? activeCategory === 'desktop' : filteredCategories.some((c) => c.id === 'desktop')) && wallpaper && onWallpaperChange && (
            <div className={styles.settingsSection}>
              <WallpaperPicker wallpaper={wallpaper} onChange={onWallpaperChange} />
            </div>
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
