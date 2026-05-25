import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, DeviceIcon, TrashIcon } from '../components/ui/Icon';
import { IconImg } from '../components/ui/shared';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { preferencesIconUrl, jobsIconUrl, driveIconUrl } from '../api/icons';
import type { BlockDevice, TrashEntry, Job } from '../api/client';
import { formatBytes, formatDeviceUsage } from '../utils/format';
import { cycleViewMode, type ViewMode } from '../utils/view';
import styles from './DesktopView.module.css';

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
  wallpaperStyle?: React.CSSProperties;
};

type DesktopIconItem = {
  id: string;
  type: 'drive' | 'trash' | 'settings' | 'jobs';
  label: string;
  subtitle: string;
  ariaLabel: string;
  onClick: () => void;
  badge?: number;
  icon: React.ReactNode;
};

const ORDER_KEY = 'volum_desktopOrder';

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveOrder(ids: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

export function DesktopView({
  devices, trashEntries, jobs, selectedDriveName,
  onNavigateTo, onNavigateToTrash, onOpenSettings, onOpenJobs, onSelectDrive,
  viewMode, onSetViewMode, theme, onToggleTheme, session, onLogout,
  deviceError, onRetryDevices, wallpaperStyle,
}: DesktopViewProps) {
  const activeJobCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused').length;
  const [iconOrder, setIconOrder] = useState<string[]>(loadOrder);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    saveOrder(iconOrder);
  }, [iconOrder]);

  const iconItems = useMemo(() => {
    const items: DesktopIconItem[] = [];

    for (const dev of devices) {
      items.push({
        id: `drive-${dev.name}`,
        type: 'drive',
        label: dev.model || dev.name,
        subtitle: `${dev.size || ''}${dev.transport ? ` · ${dev.transport.toUpperCase()}` : ''}${dev.rotational ? ' · HDD' : ' · SSD'} · ${(() => { const c = dev.partitions?.filter(p => p.volumPath).length ?? 0; return `${c} volume${c !== 1 ? 's' : ''} mounted`; })()}`,
        ariaLabel: `Open ${dev.model || dev.name}${dev.size ? `, ${dev.size}` : ''}${dev.transport ? `, ${dev.transport.toUpperCase()}` : ''}${dev.rotational ? ', HDD' : ', SSD'}`,
        onClick: () => onSelectDrive(dev.name),
        icon: <DeviceIcon name="drive-harddisk" size={64} />,
      });
    }

    items.push({
      id: 'trash',
      type: 'trash',
      label: 'Trash',
      subtitle: trashEntries.length === 0 ? 'Empty' : `${trashEntries.length} item${trashEntries.length === 1 ? '' : 's'}`,
      ariaLabel: `Open Trash${trashEntries.length > 0 ? `, ${trashEntries.length} items` : ', empty'}`,
      onClick: onNavigateToTrash,
      badge: trashEntries.length > 0 ? trashEntries.length : undefined,
      icon: (
        <div className={styles.desktopIconWrapper}>
          <TrashIcon full={trashEntries.length > 0} size={64} />
          {trashEntries.length > 0 && <span className={styles.desktopTrashBadge}>{trashEntries.length}</span>}
        </div>
      ),
    });

    items.push({
      id: 'settings',
      type: 'settings',
      label: 'Settings',
      subtitle: 'System info &amp; maintenance',
      ariaLabel: 'Open Settings',
      onClick: onOpenSettings,
      icon: (
        <div className={styles.desktopIconWrapper}>
          <IconImg src={preferencesIconUrl()} alt="" width={64} height={64} />
        </div>
      ),
    });

    items.push({
      id: 'jobs',
      type: 'jobs',
      label: 'Jobs',
      subtitle: jobs.length === 0 ? 'No jobs' : `${activeJobCount} active`,
      ariaLabel: `Open Jobs${activeJobCount > 0 ? `, ${activeJobCount} active` : ', no active jobs'}`,
      onClick: onOpenJobs,
      badge: activeJobCount > 0 ? activeJobCount : undefined,
      icon: (
        <div className={styles.desktopIconWrapper}>
          <IconImg src={jobsIconUrl()} alt="" width={64} height={64} />
          {activeJobCount > 0 && (
            <span className={styles.desktopTrashBadge}>{activeJobCount}</span>
          )}
        </div>
      ),
    });

    const order = iconOrder.filter((id) => items.some((item) => item.id === id));
    const ordered: DesktopIconItem[] = [];
    const used = new Set<string>();
    for (const id of order) {
      const item = items.find((i) => i.id === id);
      if (item) { ordered.push(item); used.add(id); }
    }
    for (const item of items) {
      if (!used.has(item.id)) ordered.push(item);
    }
    return ordered;
  }, [devices, trashEntries, jobs, activeJobCount, iconOrder, onSelectDrive, onNavigateToTrash, onOpenSettings, onOpenJobs]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) { setDragId(null); setDropTarget(null); return; }
    const ids = iconOrder.filter((id) => iconItems.some((item) => item.id === id));
    const srcIdx = ids.indexOf(sourceId);
    const tgtIdx = ids.indexOf(targetId);
    if (srcIdx === -1) { setDragId(null); setDropTarget(null); return; }
    const next = [...ids];
    next.splice(srcIdx, 1);
    const insertAt = tgtIdx >= 0 ? tgtIdx : next.length;
    next.splice(insertAt, 0, sourceId);
    setIconOrder(next);
    setDragId(null);
    setDropTarget(null);
  }, [iconOrder, iconItems]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);

  if (selectedDriveName) {
    const d = devices.find(dd => dd.name === selectedDriveName);
    const driveLabel = d?.model || d?.name || selectedDriveName;
    return (
      <div className={styles.desktopWrapper} style={wallpaperStyle}>
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
      </div>
    );
  }

  return (
    <div className={styles.desktopWrapper} style={wallpaperStyle}>
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
        {iconItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.desktopIcon}${dragId === item.id ? ` ${styles.desktopDragging}` : ''}${dropTarget === item.id ? ` ${styles.desktopDropTarget}` : ''}`}
            onClick={item.onClick}
            type="button"
            aria-label={item.ariaLabel}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
            onDragEnd={handleDragEnd}
          >
            {item.icon}
            <span className={styles.desktopIconLabel}>{item.label}</span>
            <small className={styles.desktopIconUsage} dangerouslySetInnerHTML={{ __html: item.subtitle }} />
          </button>
        ))}
      </div>
    </div>
  );
}
