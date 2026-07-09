import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import { formatBytes } from '../../utils/format';
import type { RootEntry } from '../../api/client';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsStorageProps = {
  roots: RootEntry[];
};

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

export function SettingsStorage({ roots }: SettingsStorageProps) {
  const hasUnavailableRoot = roots.some((r) => !r.available);

  return (
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
        {roots.map((root) => (
          <div
            key={root.path}
            className={`${styles.settingsRootItem}${!root.available ? ` ${styles.rootUnavailable}` : ''}`}
          >
            <div className={styles.settingsRootName}>
              <span>{rootLabel(root)}</span>
              <small>{root.path}</small>
            </div>
            {root.available && root.totalBytes > 0 && (
              <ProgressBar
                value={Math.min((root.usedBytes / root.totalBytes) * 100, 100)}
                className={styles.rootMeter}
              />
            )}
            <small>
              {root.available
                ? formatRootUsage(root)
                : 'Unavailable — check mount or configuration'}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
