import { useDesktopIcons, type DesktopIconItem } from '../hooks/useDesktopIcons';
import type { TrashEntry, Job } from '../api/client';
import type { ServiceHealthResult, ServiceShortcut } from '../utils/services';
import styles from './DesktopView.module.css';

type DesktopViewProps = {
  trashEntries: TrashEntry[];
  jobs: Job[];
  pendingTransferCount?: number;
  favorites: string[];
  services: ServiceShortcut[];
  serviceHealth: Record<string, ServiceHealthResult>;
  onNavigateTo: (path: string) => void;
  onNavigateToTrash: () => void;
  onOpenSettings: () => void;
  onOpenJobs: () => void;
  onOpenFiles: () => void;
  onOpenService: (service: ServiceShortcut) => void;
  onShowMyPC: () => void;
  onItemContextMenu: (item: DesktopIconItem, event: React.MouseEvent<HTMLElement>) => void;
};

export function DesktopView({
  trashEntries,
  jobs,
  pendingTransferCount = 0,
  favorites,
  services,
  serviceHealth,
  onNavigateTo,
  onNavigateToTrash,
  onOpenSettings,
  onOpenJobs,
  onOpenFiles,
  onOpenService,
  onShowMyPC,
  onItemContextMenu,
}: DesktopViewProps) {
  const {
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
  } = useDesktopIcons({
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
  });

  return (
    <div
      className={styles.desktopWrapper}
      onContextMenu={(event) => {
        onItemContextMenu(
          { id: '', type: 'emptySpace', label: '', ariaLabel: '', onClick: () => {} },
          event,
        );
      }}
    >
      <div className={styles.desktop}>
        {iconItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.desktopIcon}${dragId === item.id ? ` ${styles.desktopDragging}` : ''}${dropTarget === item.id ? ` ${styles.desktopDropTarget}` : ''}`}
            onClick={item.onClick}
            onContextMenu={(event) => {
              event.stopPropagation();
              onItemContextMenu(item, event);
            }}
            type="button"
            aria-label={item.ariaLabel}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
            onDragEnd={handleDragEnd}
            onTouchStart={(event) => handleItemTouchStart(item, event)}
            onTouchMove={handleItemTouchMove}
            onTouchEnd={handleItemTouchEnd}
          >
            {item.icon}
            <span className={styles.desktopIconLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
