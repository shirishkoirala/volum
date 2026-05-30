import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';
import styles from './ContextMenu.module.css';

interface TrashContextMenuProps {
  x: number;
  y: number;
  onRestore: () => void;
  onDeletePermanently: () => void;
  onClose: () => void;
}

export function TrashContextMenu({ x, y, onRestore, onDeletePermanently, onClose }: TrashContextMenuProps) {
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <button type="button" onClick={() => { onRestore(); onClose(); }} role="menuitem">
        <Icon name="edit-restore" size={16} /> Restore
      </button>
      <button type="button" className={styles.danger} onClick={() => { onDeletePermanently(); onClose(); }} role="menuitem">
        <Icon name="edit-delete" size={16} /> Delete permanently
      </button>
    </ContextMenuShell>
  );
}
