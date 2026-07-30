import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, MutedText } from '../ui/shared';
import { ErrorBanner } from '../ui/ErrorBanner';
import {
  listUsers,
  createUser,
  deleteUser,
  changePassword,
  changeRole,
  type Session,
  type UserInfo,
} from '../../api/client-auth';
import type { StatusResponse } from '../../api/client-files';
import { dbVacuum, pruneJobs } from '../../api/client-services';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsAdminProps = {
  status: StatusResponse;
  session: Session | null;
  onOpenShares?: () => void;
};

export function SettingsAdmin({ status, session, onOpenShares }: SettingsAdminProps) {
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState<string | null>(null);
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

  const handleVacuum = async () => {
    setMaintenanceBusy('vacuum');
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      await dbVacuum();
      setMaintenanceMsg('Database vacuum completed.');
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
      const result = await pruneJobs();
      setMaintenanceMsg(`Pruned ${result.removed} old transfer records.`);
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Prune failed');
    } finally {
      setMaintenanceBusy(null);
    }
  };

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    listUsers()
      .then(setUsers)
      .catch((err) => setUsersError(err.message))
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    if (session?.role === 'admin') {
      loadUsers();
    }
  }, [loadUsers, session]);

  const handleCreateUser = async () => {
    setCreatingUser(true);
    setUserError(null);
    setUserMsg(null);
    if (newPassword.length < 12) {
      setUserError('Password must be at least 12 characters.');
      setCreatingUser(false);
      return;
    }
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
    if (pwdChangeValue.length < 12) {
      setUserError('Password must be at least 12 characters.');
      return;
    }
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

  return (
    <>
      <section className={styles.settingsSection}>
        <h4>Maintenance</h4>
        <div className={styles.maintenanceActions}>
          <Button size="compact" onClick={handleVacuum} disabled={maintenanceBusy !== null}>
            {maintenanceBusy === 'vacuum' && (
              <Icon name="view-refresh" size={12} className={styles.spin} />
            )}
            Vacuum DB
          </Button>
          <Button size="compact" onClick={handlePruneJobs} disabled={maintenanceBusy !== null}>
            {maintenanceBusy === 'pruneJobs' && (
              <Icon name="view-refresh" size={12} className={styles.spin} />
            )}
            Prune Old Jobs
          </Button>
        </div>
        {maintenanceMsg && (
          <p className={styles.maintenanceMsg} role="status">
            {maintenanceMsg}
          </p>
        )}
        {maintenanceError && (
          <p className={styles.maintenanceError} role="alert">
            {maintenanceError}
          </p>
        )}
      </section>

      <section className={styles.settingsSection}>
        <h4>Jobs</h4>
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
          {users === null && !usersLoading && (
            <Button size="compact" onClick={loadUsers}>
              Load Users
            </Button>
          )}
          {usersLoading && <MutedText>Loading...</MutedText>}
          {usersError && <ErrorBanner message={usersError} onRetry={loadUsers} />}
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
                              aria-label={`New password for ${u.username}`}
                              minLength={12}
                              value={pwdChangeValue}
                              onChange={(e) => setPwdChangeValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleChangePassword(u.id);
                                if (e.key === 'Escape') {
                                  setPwdChangeUserId(null);
                                  setPwdChangeValue('');
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="compact"
                              disabled={pwdChangeValue.length < 12}
                              onClick={() => handleChangePassword(u.id)}
                            >
                              Set
                            </Button>
                            <Button
                              size="compact"
                              onClick={() => {
                                setPwdChangeUserId(null);
                                setPwdChangeValue('');
                              }}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <>
                            <Button
                              size="compact"
                              onClick={() => {
                                setPwdChangeUserId(u.id);
                                setPwdChangeValue('');
                              }}
                            >
                              Password
                            </Button>
                            <Button
                              size="compact"
                              onClick={() =>
                                handleChangeRole(u.id, u.role === 'admin' ? 'readonly' : 'admin')
                              }
                            >
                              Make {u.role === 'admin' ? 'readonly' : 'admin'}
                            </Button>
                            <Button
                              size="compact"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                            >
                              Delete
                            </Button>
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
              <label className={styles.formField}>
                <span>Username</span>
                <input
                  autoComplete="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </label>
              <label className={styles.formField}>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  aria-describedby="new-user-password-help"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <small id="new-user-password-help">At least 12 characters</small>
              </label>
              <label className={styles.formField}>
                <span>Role</span>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'readonly')}
                >
                  <option value="readonly">Readonly</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <Button
                size="compact"
                disabled={creatingUser || !newUsername || newPassword.length < 12}
                onClick={handleCreateUser}
              >
                {creatingUser ? (
                  <>
                    <Icon name="view-refresh" size={12} className={styles.spin} /> Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </details>
          {userMsg && (
            <p className={styles.maintenanceMsg} role="status">
              {userMsg}
            </p>
          )}
          {userError && (
            <p className={styles.maintenanceError} role="alert">
              {userError}
            </p>
          )}
        </section>
      )}

      {onOpenShares && (
        <section className={styles.settingsSection}>
          <h4>Shares</h4>
          <p>
            <MutedText compact>Manage expiring share links for files and folders.</MutedText>
          </p>
          <div className={styles.sharesActions}>
            <Button size="compact" onClick={onOpenShares}>
              Manage Shares
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
