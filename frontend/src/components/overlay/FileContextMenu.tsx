import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';
import type { MenuCapabilities } from '../../types/capabilities';
import styles from './ContextMenu.module.css';

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
        <button
          type="button"
          onClick={() => {
            onPreview();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="view-preview" size={16} /> Preview
        </button>
      )}
      {canInfo && (
        <button
          type="button"
          onClick={() => {
            onShowInfo();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="dialog-information" size={16} /> Info
        </button>
      )}
      {canDownload && (
        <button
          type="button"
          onClick={() => {
            onDownload();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-download" size={16} /> Download
        </button>
      )}
      {canWrite && canRename && (
        <button
          type="button"
          onClick={() => {
            onRename();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-rename" size={16} /> Rename
        </button>
      )}
      {canWrite && selectedCount > 1 && (
        <button
          type="button"
          onClick={() => {
            onBatchRename();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-rename" size={16} /> Batch rename
        </button>
      )}
      {canWrite && canCopy && (
        <button
          type="button"
          onClick={() => {
            onCopy();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-copy" size={16} /> Copy
        </button>
      )}
      {canWrite && canMove && (
        <button
          type="button"
          onClick={() => {
            onMove();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-cut" size={16} /> Move
        </button>
      )}
      {canWrite && canArchive && (
        <button
          type="button"
          onClick={() => {
            onArchive();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="archive-create" size={16} /> Archive
        </button>
      )}
      {canWrite && canExtract && (
        <button
          type="button"
          onClick={() => {
            onExtract();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="archive-extract" size={16} /> Extract
        </button>
      )}
      {canChecksum && (
        <button
          type="button"
          onClick={() => {
            onChecksum();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="view-refresh" size={16} /> Checksum
        </button>
      )}
      {canPaste && (
        <button
          type="button"
          onClick={() => {
            onPaste();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-paste" size={16} /> Paste
        </button>
      )}
      {canWrite && (
        <button
          type="button"
          onClick={() => {
            onQuickShare();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="mail-send" size={16} /> Quick Share
        </button>
      )}
      {canInfo && (
        <button
          type="button"
          onClick={() => {
            onShare();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="mail-send" size={16} /> Share
        </button>
      )}
      {onAnalyze && (
        <button
          type="button"
          onClick={() => {
            onAnalyze();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-find" size={16} /> Analyze folder
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          onToggleFavorite();
          onClose();
        }}
        role="menuitem"
      >
        <Icon name="bookmark-new" size={16} />{' '}
        {isFavorited ? 'Remove from desktop' : 'Add to desktop'}
      </button>
      {canWrite && canDelete && (
        <button
          type="button"
          className={styles.danger}
          onClick={() => {
            onDelete();
            onClose();
          }}
          role="menuitem"
        >
          <Icon name="edit-delete" size={16} /> Delete
        </button>
      )}
    </ContextMenuShell>
  );
}
