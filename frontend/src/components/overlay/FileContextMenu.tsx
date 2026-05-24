import { Icon } from '../ui/Icon';
import styles from './ContextMenu.module.css';

interface FileContextMenuProps {
  x: number;
  y: number;
  canPreview: boolean;
  canInfo: boolean;
  canDownload: boolean;
  canRename: boolean;
  canArchive: boolean;
  canExtract: boolean;
  canChecksum: boolean;
  canCopy: boolean;
  canMove: boolean;
  canPaste: boolean;
  canDelete: boolean;
  canWrite: boolean;
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
  onDelete: () => void;
  onClose: () => void;
}

export function FileContextMenu({
  x, y, canPreview, canInfo, canDownload, canRename, canArchive, canExtract,
  canChecksum, canCopy, canMove, canPaste, canDelete, canWrite, selectedCount,
  onPreview, onShowInfo, onDownload, onRename, onBatchRename, onCopy, onMove,
  onArchive, onExtract, onChecksum, onPaste, onQuickShare, onShare, onDelete, onClose,
}: FileContextMenuProps) {
  return (
    <div
      className={styles.contextMenu}
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 300) }}
      onClick={(e) => { e.stopPropagation(); }}
    >
      <button type="button" onClick={() => { onPreview(); onClose(); }} disabled={!canPreview}>
        <Icon name="view-preview" size={16} /> Preview
      </button>
      <button type="button" onClick={() => { onShowInfo(); onClose(); }} disabled={!canInfo}>
        <Icon name="dialog-information" size={16} /> Info
      </button>
      <button type="button" onClick={() => { onDownload(); onClose(); }} disabled={!canDownload}>
        <Icon name="edit-download" size={16} /> Download
      </button>
      <button type="button" onClick={() => { onRename(); onClose(); }} disabled={!canWrite || !canRename}>
        <Icon name="edit-rename" size={16} /> Rename
      </button>
      {canWrite && selectedCount > 1 && (
        <button type="button" onClick={() => { onBatchRename(); onClose(); }}>
          <Icon name="edit-rename" size={16} /> Batch rename
        </button>
      )}
      <button type="button" onClick={() => { onCopy(); onClose(); }} disabled={!canWrite || !canCopy}>
        <Icon name="edit-copy" size={16} /> Copy
      </button>
      <button type="button" onClick={() => { onMove(); onClose(); }} disabled={!canWrite || !canMove}>
        <Icon name="edit-cut" size={16} /> Move
      </button>
      <button type="button" onClick={() => { onArchive(); onClose(); }} disabled={!canWrite || !canArchive}>
        <Icon name="archive-create" size={16} /> Archive
      </button>
      <button type="button" onClick={() => { onExtract(); onClose(); }} disabled={!canWrite || !canExtract}>
        <Icon name="archive-extract" size={16} /> Extract
      </button>
      <button type="button" onClick={() => { onChecksum(); onClose(); }} disabled={!canChecksum}>
        <Icon name="view-refresh" size={16} /> Checksum
      </button>
      <button type="button" onClick={onPaste} disabled={!canPaste}>
        <Icon name="edit-paste" size={16} /> Paste
      </button>
      {canWrite && (
        <button type="button" onClick={() => { onQuickShare(); onClose(); }}>
          <Icon name="mail-send" size={16} /> Quick Share
        </button>
      )}
      {canInfo && (
        <button type="button" onClick={() => { onShare(); onClose(); }}>
          <Icon name="mail-send" size={16} /> Share
        </button>
      )}
      <button type="button" className={styles.danger} onClick={() => { onDelete(); onClose(); }} disabled={!canWrite || !canDelete}>
        <Icon name="edit-delete" size={16} /> Delete
      </button>
    </div>
  );
}
