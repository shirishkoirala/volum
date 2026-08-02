import { ContextMenuItem, ContextMenuShell } from './ContextMenuShell';
import type { DesktopIconItem } from '../../hooks/useDesktopIcons';
import styles from './ContextMenu.module.css';

interface DesktopContextMenuProps {
  x: number;
  y: number;
  item: DesktopIconItem;
  trashCount: number;
  canManage: boolean;
  onRefresh: () => void;
  onEmptyTrash: () => void;
  onRemoveFavorite: (path: string) => void;
  onAddService: () => void;
  onEditService: (id: string) => void;
  onRemoveService: (id: string) => void;
  onClose: () => void;
}

export function DesktopContextMenu({
  x,
  y,
  item,
  trashCount,
  canManage,
  onRefresh,
  onEmptyTrash,
  onRemoveFavorite,
  onAddService,
  onEditService,
  onRemoveService,
  onClose,
}: DesktopContextMenuProps) {
  const favPath = item.type === 'folderShortcut' ? item.id.replace(/^fav-/, '') : null;
  const svcId = item.type === 'serviceShortcut' ? item.id.replace(/^svc-/, '') : null;

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      {item.type !== 'emptySpace' && (
        <ContextMenuItem icon="document-open" onSelect={item.onClick}>
          Open {item.label}
        </ContextMenuItem>
      )}
      {item.type === 'drives' && (
        <ContextMenuItem icon="view-refresh" onSelect={onRefresh}>
          Refresh drives
        </ContextMenuItem>
      )}
      {canManage && item.type === 'trash' && trashCount > 0 && (
        <ContextMenuItem icon="edit-delete" onSelect={onEmptyTrash} danger>
          Empty Trash
        </ContextMenuItem>
      )}
      {item.type === 'folderShortcut' && favPath && (
        <ContextMenuItem icon="bookmark-new" onSelect={() => onRemoveFavorite(favPath)}>
          Remove from desktop
        </ContextMenuItem>
      )}
      {canManage && item.type === 'serviceShortcut' && svcId && (
        <>
          <ContextMenuItem icon="document-properties" onSelect={() => onEditService(svcId)}>
            Edit...
          </ContextMenuItem>
          <ContextMenuItem icon="edit-delete" onSelect={() => onRemoveService(svcId)} danger>
            Remove from desktop
          </ContextMenuItem>
        </>
      )}
      {item.type === 'emptySpace' && (
        <>
          {canManage && (
            <>
              <ContextMenuItem icon="internet-web-browser" onSelect={onAddService}>
                Add Service...
              </ContextMenuItem>
              <div className={styles.separator} />
            </>
          )}
          <ContextMenuItem icon="view-refresh" onSelect={onRefresh}>
            Refresh
          </ContextMenuItem>
        </>
      )}
    </ContextMenuShell>
  );
}
