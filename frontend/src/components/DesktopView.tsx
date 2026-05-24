import { Icon, DeviceIcon, TrashIcon } from './Icon';
import { IconImg } from './shared';
import { BreadcrumbBar } from './BreadcrumbBar';
import { ProgressBar } from './ProgressBar';
import { EmptyState } from './EmptyState';
import { preferencesIconUrl, jobsIconUrl, driveIconUrl } from '../api/icons';
import type { BlockDevice, TrashEntry, Job } from '../api/client';
import styles from './DesktopView.module.css';

function formatBytes(value: number) {
  if (value == null || Number.isNaN(value) || value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDeviceUsage(part: BlockDevice) {
  if (part.totalBytes != null && part.totalBytes > 0) {
    const fsType = part.fsType ? ` · ${part.fsType}` : '';
    return `${formatBytes(part.usedBytes!)} used of ${formatBytes(part.totalBytes)} | ${formatBytes(part.freeBytes!)} free${fsType}`;
  }
  if (part.mountPoint) return 'Usage unavailable';
  return 'Not mounted';
}

function cycleViewMode(current: 'list' | 'grid' | 'columns'): 'list' | 'grid' | 'columns' {
  return current === 'list' ? 'grid' : current === 'grid' ? 'columns' : 'list';
}

type DesktopViewProps = {
  devices: BlockDevice[];
  trashEntries: TrashEntry[];
  jobs: Job[];
  selectedDriveName: string | null;
  onNavigateTo: (path: string) => void;
  onNavigateToTrash: () => void;
  onOpenSettings: () => void;
  onOpenJobs: () => void;
  onSelectDrive: (name: string | null) => void;
  viewMode: 'list' | 'grid' | 'columns';
  onSetViewMode: (mode: 'list' | 'grid' | 'columns') => void;
  theme: string;
  onToggleTheme: () => void;
  session?: { authEnabled: boolean } | null;
  onLogout: () => void;
  deviceError?: string | null;
  onRetryDevices?: () => void;
};

export function DesktopView({
  devices, trashEntries, jobs, selectedDriveName,
  onNavigateTo, onNavigateToTrash, onOpenSettings, onOpenJobs, onSelectDrive,
  viewMode, onSetViewMode, theme, onToggleTheme, session, onLogout,
  deviceError, onRetryDevices,
}: DesktopViewProps) {
  const activeJobCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused').length;

  if (selectedDriveName) {
    const d = devices.find(dd => dd.name === selectedDriveName);
    const driveLabel = d?.model || d?.name || selectedDriveName;
    return (
      <>
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: driveLabel }]}
          onBack={() => onSelectDrive(null)}
          onNavigate={() => {}}
        />
        <div className={styles.driveContents}>
          {d?.partitions?.map((part) =>
            part.volumPath ? (
              <button key={part.name} className={styles.drivePartitionItem} onClick={() => onNavigateTo(part.volumPath!)} type="button">
                <DeviceIcon name="drive-harddisk" size={32} />
                <span className={styles.drivePartitionInfo}>
                  <span>{part.label || part.name}</span>
                  <small>{part.volumPath}</small>
                  <small>{formatDeviceUsage(part)}</small>
                  {part.totalBytes != null && part.totalBytes > 0 && (
                    <ProgressBar value={(part.usedBytes! / part.totalBytes!) * 100} className={styles.drivePartitionMeter} />
                  )}
                </span>
              </button>
            ) : (
              <div key={part.name} className={`${styles.drivePartitionItem} ${styles.partitionUnmounted}`}>
                <Icon name="media-removable" size={32} />
                <span className={styles.drivePartitionInfo}>
                  <span>{part.name}</span>
                  <small>{part.size || 'Unknown'}</small>
                  <small>Not mounted</small>
                </span>
              </div>
            )
          )}
          {(!d?.partitions?.length) && (
            <EmptyState icon={driveIconUrl('64')} title="No partitions found" />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.desktopHeader}>
          <DeviceIcon name="drive-harddisk" size={22} />
          <h1>This PC</h1>
        </div>
        <div className={styles.toolbar}>
          <button className="icon-button" onClick={() => onSetViewMode(cycleViewMode(viewMode))} title="Change view" type="button">
            {viewMode === 'list' ? (
              <Icon name="view-grid" size={18} />
            ) : viewMode === 'grid' ? (
              <Icon name="view-list-column" size={18} />
            ) : (
              <Icon name="view-list-tree" size={18} />
            )}
          </button>
          <button className="icon-button" onClick={onToggleTheme} title={theme === 'light' ? 'Dark mode' : 'Light mode'} type="button">
            {theme === 'light' ? (
              <Icon name="weather-clear-night" size={18} />
            ) : (
              <Icon name="weather-clear" size={18} />
            )}
          </button>
          {session?.authEnabled && (
            <button className="icon-button" onClick={onLogout} title="Log out" type="button">
              <Icon name="system-log-out" size={18} />
            </button>
          )}
        </div>
      </header>
      <div className={styles.desktop}>
        {deviceError && (
          <div className={styles.desktopError}>
            <Icon name="dialog-warning" size={18} />
            <span>{deviceError}</span>
            {onRetryDevices && (
              <button type="button" className={styles.retryBtn} onClick={onRetryDevices}>Retry</button>
            )}
          </div>
        )}
        {devices.map((dev) => (
          <button
            key={dev.name}
            className={styles.desktopIcon}
            onClick={() => onSelectDrive(dev.name)}
            type="button"
            aria-label={`Open ${dev.model || dev.name}`}
          >
            <DeviceIcon name="drive-harddisk" size={64} />
            <span className={styles.desktopIconLabel}>{dev.model || dev.name}</span>
            <small className={styles.desktopIconUsage}>{dev.size}{dev.transport ? ` · ${dev.transport.toUpperCase()}` : ''}{dev.rotational ? ' · HDD' : ' · SSD'}</small>
            <small className={styles.desktopIconUsage}>{(() => { const c = dev.partitions?.filter(p => p.volumPath).length ?? 0; return `${c} volume${c !== 1 ? 's' : ''} mounted`; })()}</small>
          </button>
        ))}
        <button
          className={styles.desktopIcon}
          onClick={onNavigateToTrash}
          type="button"
          aria-label="Open Trash"
        >
          <div className={styles.desktopIconWrapper}>
            <TrashIcon full={trashEntries.length > 0} size={64} />
            {trashEntries.length > 0 && <span className={styles.desktopTrashBadge}>{trashEntries.length}</span>}
          </div>
          <span className={styles.desktopIconLabel}>Trash</span>
          <small className={styles.desktopIconUsage}>{trashEntries.length === 0 ? 'Empty' : `${trashEntries.length} item${trashEntries.length === 1 ? '' : 's'}`}</small>
        </button>
        <button
          className={styles.desktopIcon}
          onClick={onOpenSettings}
          type="button"
          aria-label="Open Settings"
        >
          <div className={styles.desktopIconWrapper}>
            <IconImg src={preferencesIconUrl()} alt="" width={64} height={64} />
          </div>
          <span className={styles.desktopIconLabel}>Settings</span>
          <small className={styles.desktopIconUsage}>System info &amp; maintenance</small>
        </button>
        <button
          className={styles.desktopIcon}
          onClick={onOpenJobs}
          type="button"
          aria-label="Open Jobs"
        >
          <div className={styles.desktopIconWrapper}>
            <IconImg src={jobsIconUrl()} alt="" width={64} height={64} />
            {activeJobCount > 0 && (
              <span className={styles.desktopTrashBadge}>{activeJobCount}</span>
            )}
          </div>
          <span className={styles.desktopIconLabel}>Jobs</span>
          <small className={styles.desktopIconUsage}>{jobs.length === 0 ? 'No jobs' : `${activeJobCount} active`}</small>
        </button>
      </div>
    </>
  );
}
