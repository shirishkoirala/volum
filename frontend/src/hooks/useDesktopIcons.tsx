import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrashIcon } from '../components/ui/Icon';
import { IconImg } from '../components/ui/shared';
import {
  preferencesIconUrl,
  jobsIconUrl,
  multidiskIconUrl,
  folderBookmarksIconUrl,
  filesIconUrl,
} from '../api/icons';
import type { TrashEntry, Job } from '../api/client';
import { countActiveTransfers } from '../utils/jobs';
import type { ServiceHealthResult, ServiceShortcut } from '../utils/services';
import { useLongPress } from './useLongPress';
import styles from '../pages/DesktopView.module.css';

type DesktopIconItem = {
  id: string;
  type:
    | 'drives' | 'trash' | 'settings' | 'jobs' | 'files'
    | 'folderShortcut' | 'serviceShortcut' | 'emptySpace';
  label: string;
  ariaLabel: string;
  onClick: () => void;
  badge?: number;
  icon?: React.ReactNode;
};

type UseDesktopIconsProps = {
  trashEntries: TrashEntry[];
  jobs: Job[];
  pendingTransferCount: number;
  favorites: string[];
  services: ServiceShortcut[];
  serviceHealth: Record<string, ServiceHealthResult>;
  onShowMyPC: () => void;
  onNavigateToTrash: () => void;
  onOpenSettings: () => void;
  onOpenJobs: () => void;
  onOpenFiles: () => void;
  onNavigateTo: (path: string) => void;
  onOpenService: (service: ServiceShortcut) => void;
  onItemContextMenu: (item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => void;
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

export type { DesktopIconItem };

export function useDesktopIcons(props: UseDesktopIconsProps) {
  const {
    trashEntries,
    jobs,
    pendingTransferCount,
    favorites,
    services,
    serviceHealth,
    onShowMyPC,
    onNavigateToTrash,
    onOpenSettings,
    onOpenJobs,
    onOpenFiles,
    onNavigateTo,
    onOpenService,
    onItemContextMenu,
  } = props;

  const activeTransferCount = countActiveTransfers(jobs, pendingTransferCount);
  const [iconOrder, setIconOrder] = useState<string[]>(loadOrder);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    saveOrder(iconOrder);
  }, [iconOrder]);

  const iconItems = useMemo(() => {
    const items: DesktopIconItem[] = [];

    items.push({
      id: 'drives',
      type: 'drives',
      label: 'Drives',
      ariaLabel: 'Show Drives',
      onClick: onShowMyPC,
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
          {trashEntries.length > 0 && (
            <span className={styles.desktopTrashBadge}>{trashEntries.length}</span>
          )}
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
      ariaLabel: `Open Transfers${activeTransferCount > 0 ? `, ${activeTransferCount} active` : ', no active transfers'}`,
      onClick: onOpenJobs,
      badge: activeTransferCount > 0 ? activeTransferCount : undefined,
      icon: (
        <div className={styles.desktopIconWrapper}>
          <IconImg src={jobsIconUrl()} alt="" width={64} height={64} />
          {activeTransferCount > 0 && (
            <span className={styles.desktopTrashBadge}>{activeTransferCount}</span>
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
      const health = svc.healthUrl ? serviceHealth[svc.id] : undefined;
      const healthLabel = svc.healthUrl
        ? `${svc.name} health: ${health?.status ?? 'checking'}`
        : undefined;
      items.push({
        id: `svc-${svc.id}`,
        type: 'serviceShortcut',
        label: svc.name,
        ariaLabel: `Open ${svc.name}`,
        onClick: () => onOpenService(svc),
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
            {svc.healthUrl && (
              <span
                className={`${styles.serviceHealthDot} ${health?.status === 'healthy' ? styles.serviceHealthHealthy : health?.status === 'unhealthy' ? styles.serviceHealthUnhealthy : styles.serviceHealthChecking}`}
                title={healthLabel}
                aria-label={healthLabel}
              />
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
      if (item) {
        ordered.push(item);
        used.add(id);
      }
    }
    for (const item of items) {
      if (!used.has(item.id)) ordered.push(item);
    }
    return ordered;
  }, [
    trashEntries, favorites, services, serviceHealth, activeTransferCount,
    iconOrder, onShowMyPC, onNavigateToTrash, onOpenSettings, onOpenJobs,
    onOpenFiles, onOpenService, onNavigateTo,
  ]);

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

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain');
      if (!sourceId || sourceId === targetId) {
        setDragId(null);
        setDropTarget(null);
        return;
      }
      const ids = iconOrder.filter((id) => iconItems.some((item) => item.id === id));
      const srcIdx = ids.indexOf(sourceId);
      const tgtIdx = ids.indexOf(targetId);
      if (srcIdx === -1) {
        setDragId(null);
        setDropTarget(null);
        return;
      }
      const next = [...ids];
      next.splice(srcIdx, 1);
      const insertAt = tgtIdx >= 0 ? tgtIdx : next.length;
      next.splice(insertAt, 0, sourceId);
      setIconOrder(next);
      setDragId(null);
      setDropTarget(null);
    },
    [iconOrder, iconItems],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);

  // ── Touch long-press context menu ────────────────────────
  const longPressItemRef = useRef<{ item: DesktopIconItem; x: number; y: number } | null>(null);

  const { onTouchStart: hookTouchStart, onTouchEnd: hookTouchEnd } = useLongPress({
    onLongPress: () => {
      const lp = longPressItemRef.current;
      if (lp) {
        longPressItemRef.current = null;
        onItemContextMenu(lp.item, {
          clientX: lp.x,
          clientY: lp.y,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.MouseEvent<HTMLElement>);
      }
    },
    delay: 500,
  });

  const handleItemTouchStart = useCallback(
    (item: DesktopIconItem, event: React.TouchEvent) => {
      const touch = event.touches[0]!;
      longPressItemRef.current = { item, x: touch.clientX, y: touch.clientY };
      hookTouchStart();
    },
    [hookTouchStart],
  );

  const handleItemTouchMove = useCallback(() => {
    longPressItemRef.current = null;
  }, []);

  const handleItemTouchEnd = useCallback(() => {
    hookTouchEnd();
  }, [hookTouchEnd]);

  return {
    iconItems,
    dragId,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleItemTouchStart,
    handleItemTouchMove,
    handleItemTouchEnd,
  };
}
