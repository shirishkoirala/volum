import { ContextMenuItem, ContextMenuShell } from './ContextMenuShell';
import type { MenuCapabilities } from '../../types/capabilities';

interface FileContextMenuProps {
  x: number;
  y: number;
  caps: MenuCapabilities;
  isFavorited: boolean;
  selectedCount: number;
  onPreview: () => void;
  onShowInfo: () => void;
  onDownload: () => void;
  onRename: () => void;
  onBatchRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onArchive: () => void;
  onExtract: () => void;
  onChecksum: () => void;
  onPaste: () => void;
  onQuickShare: () => void;
  onShare: () => void;
  onAnalyze?: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function FileContextMenu({
  x,
  y,
  caps,
  isFavorited,
  selectedCount,
  onPreview,
  onShowInfo,
  onDownload,
  onRename,
  onBatchRename,
  onCopy,
  onMove,
  onArchive,
  onExtract,
  onChecksum,
  onPaste,
  onQuickShare,
  onShare,
  onAnalyze,
  onToggleFavorite,
  onDelete,
  onClose,
}: FileContextMenuProps) {
  const {
    canWrite,
    canPreview,
    canInfo,
    canDownload,
    canRename,
    canArchive,
    canExtract,
    canChecksum,
    canCopy,
    canMove,
    canPaste,
    canDelete,
  } = caps;

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      {canPreview && (
        <ContextMenuItem icon="view-preview" onSelect={onPreview}>
          Preview
        </ContextMenuItem>
      )}
      {canInfo && (
        <ContextMenuItem icon="dialog-information" onSelect={onShowInfo}>
          Info
        </ContextMenuItem>
      )}
      {canDownload && (
        <ContextMenuItem icon="edit-download" onSelect={onDownload}>
          Download
        </ContextMenuItem>
      )}
      {canWrite && canRename && (
        <ContextMenuItem icon="edit-rename" onSelect={onRename}>
          Rename
        </ContextMenuItem>
      )}
      {canWrite && selectedCount > 1 && (
        <ContextMenuItem icon="edit-rename" onSelect={onBatchRename}>
          Batch rename
        </ContextMenuItem>
      )}
      {canWrite && canCopy && (
        <ContextMenuItem icon="edit-copy" onSelect={onCopy}>
          Copy
        </ContextMenuItem>
      )}
      {canWrite && canMove && (
        <ContextMenuItem icon="edit-cut" onSelect={onMove}>
          Move
        </ContextMenuItem>
      )}
      {canWrite && canArchive && (
        <ContextMenuItem icon="archive-create" onSelect={onArchive}>
          Archive
        </ContextMenuItem>
      )}
      {canWrite && canExtract && (
        <ContextMenuItem icon="archive-extract" onSelect={onExtract}>
          Extract
        </ContextMenuItem>
      )}
      {canChecksum && (
        <ContextMenuItem icon="view-refresh" onSelect={onChecksum}>
          Checksum
        </ContextMenuItem>
      )}
      {canPaste && (
        <ContextMenuItem icon="edit-paste" onSelect={onPaste}>
          Paste
        </ContextMenuItem>
      )}
      {canWrite && (
        <ContextMenuItem icon="mail-send" onSelect={onQuickShare}>
          Quick Share
        </ContextMenuItem>
      )}
      {canWrite && canInfo && (
        <ContextMenuItem icon="mail-send" onSelect={onShare}>
          Share
        </ContextMenuItem>
      )}
      {canWrite && onAnalyze && (
        <ContextMenuItem icon="edit-find" onSelect={onAnalyze}>
          Analyze folder
        </ContextMenuItem>
      )}
      <ContextMenuItem icon="bookmark-new" onSelect={onToggleFavorite}>
        {isFavorited ? 'Remove from desktop' : 'Add to desktop'}
      </ContextMenuItem>
      {canWrite && canDelete && (
        <ContextMenuItem icon="edit-delete" onSelect={onDelete} danger>
          Delete
        </ContextMenuItem>
      )}
    </ContextMenuShell>
  );
}
