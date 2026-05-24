import { Icon } from '../ui/Icon';
import styles from './SelectionToolbar.module.css';

interface SelectionToolbarProps {
  selectedCount: number;
  canSelect: boolean;
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
  onSelectAll: () => void;
  onInvertSelection: () => void;
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
  onDelete: () => void;
  onClearSelection: () => void;
}

export function SelectionToolbar({
  selectedCount, canSelect, canPreview, canInfo, canDownload,
  canRename, canArchive, canExtract, canChecksum, canCopy, canMove,
  canPaste, canDelete, canWrite,
  onSelectAll, onInvertSelection, onPreview, onShowInfo, onDownload,
  onRename, onBatchRename, onCopy, onMove, onArchive, onExtract,
  onChecksum, onPaste, onDelete, onClearSelection,
}: SelectionToolbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.selectionBar}>
        <span>{selectedCount} selected</span>
        <div className={styles.selectionActions}>
          <button type="button" onClick={onSelectAll} disabled={!canSelect}>
            <Icon name="selection-select-all" size={16} />
            Select all
          </button>
          <button type="button" onClick={onInvertSelection} disabled={!canSelect}>
            <Icon name="selection-invert" size={16} />
            Invert
          </button>
          {canPreview && (
            <button type="button" onClick={onPreview}>
              <Icon name="view-preview" size={16} />
              Preview
            </button>
          )}
          {canInfo && (
            <button type="button" onClick={onShowInfo}>
              <Icon name="dialog-information" size={16} />
              Info
            </button>
          )}
          {canDownload && (
            <button type="button" onClick={onDownload}>
              <Icon name="edit-download" size={16} />
              Download
            </button>
          )}
          {canRename && canWrite && (
            <button type="button" onClick={onRename}>
              <Icon name="edit-rename" size={16} />
              Rename
            </button>
          )}
          {canWrite && selectedCount > 1 && (
            <button type="button" onClick={onBatchRename}>
              <Icon name="edit-rename" size={16} />
              Batch rename
            </button>
          )}
          {canCopy && canWrite && (
            <button type="button" onClick={onCopy}>
              <Icon name="edit-copy" size={16} />
              Copy
            </button>
          )}
          {canMove && canWrite && (
            <button type="button" onClick={onMove}>
              <Icon name="edit-cut" size={16} />
              Move
            </button>
          )}
          {canArchive && canWrite && (
            <button type="button" onClick={onArchive}>
              <Icon name="archive-create" size={16} />
              Archive
            </button>
          )}
          {canExtract && canWrite && (
            <button type="button" onClick={onExtract}>
              <Icon name="archive-extract" size={16} />
              Extract
            </button>
          )}
          {canChecksum && (
            <button type="button" onClick={onChecksum}>
              <Icon name="view-refresh" size={16} />
              Checksum
            </button>
          )}
          {canWrite && (
            <button type="button" onClick={onPaste} disabled={!canPaste}>
              <Icon name="edit-paste" size={16} />
              Paste
            </button>
          )}
          {canDelete && canWrite && (
            <button type="button" onClick={onDelete} className={styles.danger}>
              <Icon name="edit-delete" size={16} />
              Delete
            </button>
          )}
        </div>
        <button type="button" onClick={onClearSelection}>
          Clear
        </button>
      </div>
    </header>
  );
}
