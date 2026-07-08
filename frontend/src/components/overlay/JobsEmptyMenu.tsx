import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';

interface JobsEmptyMenuProps {
  x: number;
  y: number;
  onRefresh: () => void;
  onClose: () => void;
}

export function JobsEmptyMenu({ x, y, onRefresh, onClose }: JobsEmptyMenuProps) {
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
