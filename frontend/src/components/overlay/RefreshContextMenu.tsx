import { ContextMenuItem, ContextMenuShell } from './ContextMenuShell';

interface RefreshContextMenuProps {
  x: number;
  y: number;
  onRefresh: () => void;
  onClose: () => void;
}

export function RefreshContextMenu({ x, y, onRefresh, onClose }: RefreshContextMenuProps) {
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <ContextMenuItem icon="view-refresh" onSelect={onRefresh}>
        Refresh
      </ContextMenuItem>
    </ContextMenuShell>
  );
}
