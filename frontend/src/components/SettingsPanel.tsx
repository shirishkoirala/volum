import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Overlay } from './shared';
import { BreadcrumbBar } from './BreadcrumbBar';
import {
  getStatus,
  dbVacuum,
  dbPruneJobs,
  dbPruneAuditLogs,
  type StatusResponse,
  type RootEntry,
} from '../api/client';
import styles from './SettingsPanel.module.css';
import bStyles from './BreadcrumbBar.module.css';

type SettingsPanelProps = {
  onClose: () => void;
  onOpenShares?: () => void;
  variant?: 'overlay' | 'page';
};

type CategoryId = 'server' | 'storage' | 'admin' | 'about';

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'server', label: 'Server', icon: 'dialog-information' },
  { id: 'storage', label: 'Storage', icon: 'drive-harddisk' },
  { id: 'admin', label: 'Administration', icon: 'preferences-system' },
  { id: 'about', label: 'About', icon: 'help-about' },
];

export function SettingsPanel({ onClose, onOpenShares, variant = 'overlay' }: SettingsPanelProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('server');
  const [filterQuery, setFilterQuery] = useState('');

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

  const handleVacuum = async () => {
    setMaintenanceBusy(true);
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      await dbVacuum();
      setMaintenanceMsg('Database vacuum completed.');
      loadStatus();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Vacuum failed');
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const handlePruneJobs = async () => {
    setMaintenanceBusy(true);
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      const result = await dbPruneJobs();
      setMaintenanceMsg(`Pruned ${result.removed} old job records.`);
      loadStatus();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Prune failed');
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const handlePruneAuditLogs = async () => {
    setMaintenanceBusy(true);
    setMaintenanceMsg(null);
    setMaintenanceError(null);
    try {
      const result = await dbPruneAuditLogs();
      setMaintenanceMsg(`Pruned ${result.removed} old audit log entries.`);
      loadStatus();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Prune failed');
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const hasUnavailableRoot = status?.roots.some((r) => !r.available);

  const filteredCategories = useMemo(() => {
    if (!filterQuery.trim()) return CATEGORIES;
    const q = filterQuery.toLowerCase();
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [filterQuery]);

  const content = (
    <>
      {loading && !status ? (
        <div className={styles.settingsSkeleton}>
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={`${styles.skeletonBlock} ${styles.short}`} />
        </div>
      ) : !status ? (
        <p className="muted">Failed to load status. <button type="button" className={styles.retryBtn} onClick={() => window.location.reload()}>Retry</button></p>
      ) : (
        <>
          {(activeCategory === 'server' || filteredCategories.some((c) => c.id === 'server')) && (
            <>
              <section className={styles.settingsSection}>
                <h4>Server</h4>
                <dl className={styles.settingsDetails}>
                  <dt>Version</dt>
                  <dd>{status.version}</dd>
                  <dt>Build</dt>
                  <dd>{status.buildTime || 'Unknown'}</dd>
                  <dt>Runtime</dt>
                  <dd>{status.goVersion}</dd>
                  <dt>Uptime</dt>
                  <dd>{formatUptime(status.uptime)}</dd>
                  <dt>Worker</dt>
                  <dd>
                    <span className={styles.workerStatus}>
                      <span className={`${styles.statusDot} ${status.jobCounts.active > 0 ? styles.dotBusy : styles.dotIdle}`} />
                      {status.jobCounts.active > 0 ? 'Busy' : 'Idle'}
                    </span>
                  </dd>
                </dl>
              </section>

              <section className={styles.settingsSection}>
                <h4>Database</h4>
                <dl className={styles.settingsDetails}>
                  <dt>Path</dt>
                  <dd>{status.dbPath}</dd>
                  <dt>Size</dt>
                  <dd>{formatBytes(status.dbSize)}</dd>
                </dl>
              </section>
            </>
          )}

          {(activeCategory === 'storage' || filteredCategories.some((c) => c.id === 'storage')) && (
            <section className={styles.settingsSection}>
              <h4>Roots{hasUnavailableRoot ? <span style={{ color: 'var(--color-danger-text)', marginLeft: 8, fontSize: 11, fontWeight: 700, textTransform: 'none' }}>⚠ Some unavailable</span> : ''}</h4>
              <div className={styles.settingsRootList}>
                {status.roots.map((root) => (
                  <div key={root.path} className={`${styles.settingsRootItem}${!root.available ? ` ${styles.rootUnavailable}` : ''}`}>
                    <div className={styles.settingsRootName}>
                      <span>{rootLabel(root)}</span>
                      <small>{root.path}</small>
                    </div>
                    {root.available && root.totalBytes > 0 && (
                      <span className={styles.rootMeter}>
                        <span style={{ width: `${Math.min((root.usedBytes / root.totalBytes) * 100, 100)}%` }} />
                      </span>
                    )}
                    <small>{root.available ? formatRootUsage(root) : 'Unavailable — check mount or configuration'}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(activeCategory === 'admin' || filteredCategories.some((c) => c.id === 'admin')) && (
            <>
              <section className={styles.settingsSection}>
                <h4>Maintenance</h4>
                <div className={styles.maintenanceActions}>
                  <button type="button" className={styles.maintenanceBtn} onClick={handleVacuum} disabled={maintenanceBusy}>
                    Vacuum DB
                  </button>
                  <button type="button" className={styles.maintenanceBtn} onClick={handlePruneJobs} disabled={maintenanceBusy}>
                    Prune Old Jobs
                  </button>
                  <button type="button" className={styles.maintenanceBtn} onClick={handlePruneAuditLogs} disabled={maintenanceBusy}>
                    Prune Audit Logs
                  </button>
                </div>
                {maintenanceMsg && <p className={styles.maintenanceMsg}>{maintenanceMsg}</p>}
                {maintenanceError && <p className={styles.maintenanceError}>{maintenanceError}</p>}
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

              {onOpenShares && (
                <section className={styles.settingsSection}>
                  <h4>Shares</h4>
                  <p className="muted compact">Manage expiring share links for files and folders.</p>
                  <div style={{ marginTop: 'var(--space-sm)' }}>
                    <button type="button" className={styles.maintenanceBtn} onClick={onOpenShares}>
                      Manage Shares
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {(activeCategory === 'about' || filteredCategories.some((c) => c.id === 'about')) && (
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
        {CATEGORIES.map((cat) => (
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

  if (variant === 'page') {
    return (<>
      <BreadcrumbBar crumbs={[{ label: 'Desktop' }, { label: 'Settings' }]} onBack={onClose} onNavigate={() => {}}>
        <div className={bStyles.toolbar}>
          <button className="icon-button" onClick={loadStatus} title="Refresh" type="button">
            <Icon name="view-refresh" size={18} />
          </button>
        </div>
      </BreadcrumbBar>
      <div className={styles.settingsBodyPage}>
        {sidebarNav}
        <div className={styles.settingsContent}>
          {content}
        </div>
      </div>
    </>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div className={styles.settingsPanel}>
        <header className={styles.settingsHeader}>
          <h3>Settings</h3>
          <button className={styles.settingsClose} onClick={onClose} type="button">
            <Icon name="window-close" size={18} />
          </button>
        </header>
        <div className={styles.settingsBody}>
          {sidebarNav}
          <div className={styles.settingsContent}>
            {content}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function formatBytes(value: number) {
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
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
