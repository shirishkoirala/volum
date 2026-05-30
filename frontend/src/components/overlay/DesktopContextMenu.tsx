import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';
import type { DesktopIconItem } from '../../pages/DesktopView';
import styles from './ContextMenu.module.css';

interface DesktopContextMenuProps {
  x: number;
  y: number;
  item: DesktopIconItem;
  trashCount: number;
  onRefresh: () => void;
  onEmptyTrash: () => void;
  onRemoveFavorite: (path: string) => void;
  onAddService: () => void;
  onEditService: (id: string) => void;
  onRemoveService: (id: string) => void;
  onClose: () => void;
}

export function DesktopContextMenu({
  x, y, item, trashCount,
  onRefresh, onEmptyTrash, onRemoveFavorite, onAddService, onEditService, onRemoveService, onClose,
}: DesktopContextMenuProps) {
  const favPath = item.type === 'folderShortcut' ? item.id.replace(/^fav-/, '') : null;
  const svcId = item.type === 'serviceShortcut' ? item.id.replace(/^svc-/, '') : null;

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      {item.type !== 'emptySpace' && (
        <button type="button" onClick={() => { item.onClick(); onClose(); }} role="menuitem">
          <Icon name="document-open" size={16} /> Open {item.label}
        </button>
      )}
      {item.type === 'myPC' && (
        <button type="button" onClick={() => { onRefresh(); onClose(); }} role="menuitem">
          <Icon name="view-refresh" size={16} /> Refresh drives
        </button>
      )}
      {item.type === 'trash' && trashCount > 0 && (
        <button type="button" className={styles.danger} onClick={() => { onEmptyTrash(); onClose(); }} role="menuitem">
          <Icon name="edit-delete" size={16} /> Empty Trash
        </button>
      )}
      {item.type === 'folderShortcut' && favPath && (
        <button type="button" onClick={() => { onRemoveFavorite(favPath); onClose(); }} role="menuitem">
          <Icon name="bookmark-new" size={16} /> Remove from desktop
        </button>
      )}
      {item.type === 'serviceShortcut' && svcId && (
        <>
          <button type="button" onClick={() => { onEditService(svcId); onClose(); }} role="menuitem">
            <Icon name="document-properties" size={16} /> Edit...
          </button>
          <button type="button" className={styles.danger} onClick={() => { onRemoveService(svcId); onClose(); }} role="menuitem">
            <Icon name="edit-delete" size={16} /> Remove from desktop
          </button>
        </>
      )}
      {item.type === 'emptySpace' && (
        <>
          <button type="button" onClick={() => { onAddService(); onClose(); }} role="menuitem">
            <Icon name="internet-web-browser" size={16} /> Add Service...
          </button>
          <div className={styles.separator} />
          <button type="button" onClick={() => { onRefresh(); onClose(); }} role="menuitem">
            <Icon name="view-refresh" size={16} /> Refresh
          </button>
        </>
      )}
    </ContextMenuShell>
  );
}
