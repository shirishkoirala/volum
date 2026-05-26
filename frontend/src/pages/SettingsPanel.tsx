import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Button, MutedText } from '../components/ui/shared';
import { formatBytes, formatUptime } from '../utils/format';
import {
  getStatus,
  dbVacuum,
  dbPruneJobs,
  dbPruneAuditLogs,
  type StatusResponse,
  type RootEntry,
} from '../api/client';
import { PRESET_COLORS, PRESET_GRADIENTS, type WallpaperConfig } from '../utils/wallpaper';
import styles from './SettingsPanel.module.css';

type SettingsPanelProps = {
  onOpenShares?: () => void;
  wallpaper?: WallpaperConfig;
  onWallpaperChange?: (config: WallpaperConfig) => void;
};

type CategoryId = 'server' | 'storage' | 'desktop' | 'admin' | 'about';

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'server', label: 'Server', icon: 'dialog-information' },
  { id: 'storage', label: 'Storage', icon: 'drive-harddisk' },
  { id: 'desktop', label: 'Desktop', icon: 'monitor' },
  { id: 'admin', label: 'Administration', icon: 'preferences-system' },
  { id: 'about', label: 'About', icon: 'help-about' },
];

export function SettingsPanel({ onOpenShares, wallpaper, onWallpaperChange }: SettingsPanelProps) {
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
        <p><MutedText>Failed to load status. <Button variant="link" onClick={() => window.location.reload()}>Retry</Button></MutedText></p>
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

          {(activeCategory === 'desktop' || filteredCategories.some((c) => c.id === 'desktop')) && wallpaper && onWallpaperChange && (
            <section className={styles.settingsSection}>
              <h4>Desktop Background</h4>
              <div className={styles.wallpaperOptionRow}>
                <button
                  type="button"
                  className={`${styles.wallpaperOption}${wallpaper.type === 'default' ? ` ${styles.wallpaperOptionActive}` : ''}`}
                  onClick={() => onWallpaperChange({ type: 'default' })}
                >
                  <div className={styles.wallpaperPreview} style={{ background: 'var(--color-bg)' }} />
                  <span>Default</span>
                </button>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`${styles.wallpaperOption}${wallpaper.type === 'color' && wallpaper.value === color ? ` ${styles.wallpaperOptionActive}` : ''}`}
                    onClick={() => onWallpaperChange({ type: 'color', value: color })}
                  >
                    <div className={styles.wallpaperPreview} style={{ backgroundColor: color }} />
                    <span>{color}</span>
                  </button>
                ))}
              </div>

              <div className={styles.wallpaperOptionRow}>
                <small className={styles.wallpaperSectionLabel}>Custom Color</small>
                <div className={styles.wallpaperCustomColor}>
                  <input
                    type="color"
                    className={styles.wallpaperColorInput}
                    value={wallpaper.type === 'color' && wallpaper.value ? wallpaper.value : '#1a1a2e'}
                    onChange={(e) => onWallpaperChange({ type: 'color', value: e.target.value })}
                  />
                  <span className={styles.wallpaperColorHex}>
                    {wallpaper.type === 'color' ? wallpaper.value : '#1a1a2e'}
                  </span>
                </div>
              </div>

              <h4>Gradients</h4>
              <div className={styles.wallpaperOptionRow}>
                {PRESET_GRADIENTS.map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    className={`${styles.wallpaperOption}${wallpaper.type === 'gradient' && wallpaper.value === g.value ? ` ${styles.wallpaperOptionActive}` : ''}`}
                    onClick={() => onWallpaperChange({ type: 'gradient', value: g.value, value2: g.value2 })}
                  >
                    <div className={styles.wallpaperPreview} style={{ background: `linear-gradient(135deg, ${g.value}, ${g.value2})` }} />
                    <span>{g.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(activeCategory === 'admin' || filteredCategories.some((c) => c.id === 'admin')) && (
            <>
              <section className={styles.settingsSection}>
                <h4>Maintenance</h4>
                <div className={styles.maintenanceActions}>
                  <Button size="compact" onClick={handleVacuum} disabled={maintenanceBusy}>
                    Vacuum DB
                  </Button>
                  <Button size="compact" onClick={handlePruneJobs} disabled={maintenanceBusy}>
                    Prune Old Jobs
                  </Button>
                  <Button size="compact" onClick={handlePruneAuditLogs} disabled={maintenanceBusy}>
                    Prune Audit Logs
                  </Button>
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
