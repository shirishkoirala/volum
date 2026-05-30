import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceIcon, TrashIcon } from '../components/ui/Icon';
import { Button, IconImg, Notice } from '../components/ui/shared';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { DriveSection } from '../components/ui/DriveSection';
import { preferencesIconUrl, jobsIconUrl, driveIconUrl, multidiskIconUrl, folderBookmarksIconUrl, filesIconUrl, warningIconUrl } from '../api/icons';
import type { BlockDevice, TrashEntry, Job } from '../api/client';
import type { ServiceShortcut } from '../utils/services';
import { formatDeviceUsage } from '../utils/format';
import styles from './DesktopView.module.css';

type DesktopViewProps = {
  devices: BlockDevice[];
  trashEntries: TrashEntry[];
  jobs: Job[];
  favorites: string[];
  services: ServiceShortcut[];
  selectedDriveName: string | null;
  onNavigateTo: (path: string) => void;
  onNavigateToTrash: () => void;
  onOpenSettings: () => void;
  onOpenJobs: () => void;
  onOpenFiles: () => void;
  onSelectDrive: (name: string | null) => void;
  showingMyPC: boolean;
  onShowMyPC: (v: boolean) => void;
  deviceError?: string | null;
  onRetryDevices?: () => void;
  wallpaperStyle?: React.CSSProperties;
  onItemContextMenu: (item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => void;
};

export type DesktopIconItem = {
  id: string;
  type: 'drives' | 'trash' | 'settings' | 'jobs' | 'files' | 'folderShortcut' | 'serviceShortcut' | 'emptySpace';
  label: string;
  ariaLabel: string;
  onClick: () => void;
  badge?: number;
  icon?: React.ReactNode;
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
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save desktop order:', e);
  }
}

export function DesktopView({
  devices, trashEntries, jobs, favorites, services, selectedDriveName,
  onNavigateTo, onNavigateToTrash, onOpenSettings, onOpenJobs, onOpenFiles, onSelectDrive,
  showingMyPC, onShowMyPC,
  deviceError, onRetryDevices, wallpaperStyle,
  onItemContextMenu,
}: DesktopViewProps) {
  const activeJobCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused').length;
  const [iconOrder, setIconOrder] = useState<string[]>(loadOrder);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    saveOrder(iconOrder);
  }, [iconOrder]);

  const { internalDrives, externalDrives } = useMemo(() => {
    const internal: BlockDevice[] = [];
    const external: BlockDevice[] = [];
    for (const dev of devices) {
      const t = (dev.transport || '').toLowerCase();
      if (t === 'usb' || t === 'firewire' || t === 'thunderbolt') {
        external.push(dev);
      } else {
        internal.push(dev);
      }
    }
    return { internalDrives: internal, externalDrives: external };
  }, [devices]);

  const iconItems = useMemo(() => {
    const items: DesktopIconItem[] = [];

    items.push({
      id: 'drives',
      type: 'drives',
      label: 'Drives',

      ariaLabel: `Show Drives, ${devices.length} drive${devices.length === 1 ? '' : 's'}`,
      onClick: () => onShowMyPC(true),
      icon: (
        <div className={styles.desktopIconWrapper}>
          <IconImg src={multidiskIconUrl()} alt="" width={64} height={64} />
        </div>
      ),
    });

    items.push({
      id: 'trash',
      type: 'trash',
      label: 'Trash',

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
      label: 'Transfers',

      ariaLabel: `Open Transfers${activeJobCount > 0 ? `, ${activeJobCount} active` : ', no active transfers'}`,
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

    items.push({
      id: 'files',
      type: 'files',
      label: 'Files',

      ariaLabel: 'Open Files',
      onClick: onOpenFiles,
      icon: (
        <div className={styles.desktopIconWrapper}>
          <IconImg src={filesIconUrl()} alt="" width={64} height={64} />
        </div>
      ),
    });

    for (const path of favorites) {
      const name = path.split('/').filter(Boolean).pop() || path;
      items.push({
        id: `fav-${path}`,
        type: 'folderShortcut',
        label: name,

        ariaLabel: `Open folder ${name}`,
        onClick: () => onNavigateTo(path),
        icon: (
          <div className={styles.desktopIconWrapper}>
            <IconImg src={folderBookmarksIconUrl()} alt="" width={64} height={64} />
          </div>
        ),
      });
    }

    for (const svc of services) {
      items.push({
        id: `svc-${svc.id}`,
        type: 'serviceShortcut',
        label: svc.name,

        ariaLabel: `Open ${svc.name}`,
        onClick: () => window.open(svc.url, '_blank', 'noopener,noreferrer'),
        icon: (
          <div className={styles.desktopIconWrapper}>
            {svc.iconUrl ? (
              <IconImg src={svc.iconUrl} alt="" width={64} height={64} />
            ) : (
              <div className={styles.serviceGlobe}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
            )}
          </div>
        ),
      });
    }

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
  }, [devices, trashEntries, favorites, services, activeJobCount, iconOrder, onShowMyPC, onNavigateToTrash, onOpenSettings, onOpenJobs, onOpenFiles, onNavigateTo]);

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
      <div
        className={styles.desktopWrapper}
        style={wallpaperStyle}
        onContextMenu={(event) => {
          onItemContextMenu({ id: '', type: 'emptySpace', label: '', ariaLabel: '', onClick: () => {} }, event);
        }}
      >
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: 'Drives' }, { label: driveLabel }]}
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
                <IconImg src={driveIconUrl()} alt="" width={32} height={32} />
                <span className={styles.drivePartitionInfo}>
                  <span>{part.name}</span>
                  <small>{part.size || 'Unknown'}</small>
                  <small>Not mounted</small>
                </span>
              </div>
            )
          )}
          {(!d?.partitions?.length) && (
            <EmptyState icon={driveIconUrl()} title="No partitions found" />
          )}
        </div>
      </div>
    );
  }

  if (showingMyPC) {
    return (
      <div
        className={styles.desktopWrapper}
        style={wallpaperStyle}
        onContextMenu={(event) => {
          onItemContextMenu({ id: '', type: 'emptySpace', label: '', ariaLabel: '', onClick: () => {} }, event);
        }}
      >
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: 'Drives' }]}
          onBack={() => onShowMyPC(false)}
          onNavigate={() => {}}
        />
        <div className={styles.driveContent}>
          {deviceError && (
            <Notice variant="error" className={styles.desktopError}>
              <IconImg src={warningIconUrl()} alt="" width={18} height={18} />
              <span>{deviceError}</span>
              {onRetryDevices && (
                <Button variant="danger" size="compact" onClick={onRetryDevices}>Retry</Button>
              )}
            </Notice>
          )}
          <DriveSection title="Internal" drives={internalDrives} onSelectDrive={onSelectDrive} />
          <DriveSection title="External" drives={externalDrives} onSelectDrive={onSelectDrive} />
          {internalDrives.length === 0 && externalDrives.length === 0 && (
            <EmptyState icon={driveIconUrl()} title="No drives found" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.desktopWrapper}
      style={wallpaperStyle}
      onContextMenu={(event) => {
        onItemContextMenu({ id: '', type: 'emptySpace', label: '', ariaLabel: '', onClick: () => {} }, event);
      }}
    >
      <div className={styles.desktop}>
        {deviceError && (
          <Notice variant="error" className={styles.desktopError}>
            <IconImg src={warningIconUrl()} alt="" width={18} height={18} />
            <span>{deviceError}</span>
            {onRetryDevices && (
              <Button variant="danger" size="compact" onClick={onRetryDevices}>Retry</Button>
            )}
          </Notice>
        )}
        {iconItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.desktopIcon}${dragId === item.id ? ` ${styles.desktopDragging}` : ''}${dropTarget === item.id ? ` ${styles.desktopDropTarget}` : ''}`}
            onClick={item.onClick}
            onContextMenu={(event) => { event.stopPropagation(); onItemContextMenu(item, event); }}
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
          </button>
        ))}
      </div>
    </div>
  );
}
