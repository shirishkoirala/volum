import { ContextMenuItem, ContextMenuShell } from './ContextMenuShell';

interface TrashContextMenuProps {
  x: number;
  y: number;
  onRestore: () => void;
  onDeletePermanently: () => void;
  onClose: () => void;
}

export function TrashContextMenu({
  x,
  y,
  onRestore,
  onDeletePermanently,
  onClose,
}: TrashContextMenuProps) {
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <ContextMenuItem icon="edit-restore" onSelect={onRestore}>
        Restore
      </ContextMenuItem>
      <ContextMenuItem icon="edit-delete" onSelect={onDeletePermanently} danger>
        Delete permanently
      </ContextMenuItem>
    </ContextMenuShell>
  );
}
