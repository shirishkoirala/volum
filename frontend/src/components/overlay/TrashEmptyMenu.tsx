import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';
import styles from './ContextMenu.module.css';

interface TrashEmptyMenuProps {
  x: number;
  y: number;
  canPaste: boolean;
  onRefresh: () => void;
  onPaste: () => void;
  onClose: () => void;
}

export function TrashEmptyMenu({
  x,
  y,
  canPaste,
  onRefresh,
  onPaste,
  onClose,
}: TrashEmptyMenuProps) {
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <button
        type="button"
        onClick={() => {
          onRefresh();
          onClose();
        }}
        role="menuitem"
      >
        <Icon name="view-refresh" size={16} /> Refresh
      </button>
      <hr className={styles.separator} />
      <button
        type="button"
        onClick={() => {
          onPaste();
        }}
        disabled={!canPaste}
        role="menuitem"
      >
        <Icon name="edit-paste" size={16} /> Paste
      </button>
    </ContextMenuShell>
  );
}
