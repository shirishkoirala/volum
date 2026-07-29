import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';

interface TrashEmptyMenuProps {
  x: number;
  y: number;
  onRefresh: () => void;
  onClose: () => void;
}

export function TrashEmptyMenu({ x, y, onRefresh, onClose }: TrashEmptyMenuProps) {
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
    </ContextMenuShell>
  );
}
