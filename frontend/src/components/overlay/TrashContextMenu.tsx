import { Icon } from '../ui/Icon';
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
    <div
      className={styles.contextMenu}
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 300) }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={() => { onRestore(); onClose(); }}>
        <Icon name="edit-restore" size={16} /> Restore
      </button>
      <button type="button" className={styles.danger} onClick={() => { onDeletePermanently(); onClose(); }}>
        <Icon name="edit-delete" size={16} /> Delete permanently
      </button>
    </div>
  );
}
