import { Icon } from '../ui/Icon';
import { ContextMenuItem, ContextMenuShell } from './ContextMenuShell';
import styles from './ContextMenu.module.css';

interface FilesEmptyMenuProps {
  x: number;
  y: number;
  canWrite: boolean;
  canUpload: boolean;
  canPaste: boolean;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onUpload: () => void;
  onRefresh: () => void;
  onPaste: () => void;
  onClose: () => void;
}

export function FilesEmptyMenu({
  x,
  y,
  canWrite,
  canUpload,
  canPaste,
  onCreateFolder,
  onCreateFile,
  onUpload,
  onRefresh,
  onPaste,
  onClose,
}: FilesEmptyMenuProps) {
  function handleUpload() {
    onUpload();
    onClose();
  }

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <ContextMenuItem icon="folder-new" onSelect={onCreateFolder} disabled={!canWrite}>
        New Folder
      </ContextMenuItem>
      <ContextMenuItem icon="document-new" onSelect={onCreateFile} disabled={!canWrite}>
        New Text File
      </ContextMenuItem>
      <button
        type="button"
        onPointerDown={(event) => {
          if (!canUpload) return;
          event.preventDefault();
          event.stopPropagation();
          handleUpload();
        }}
        onClick={(event) => {
          if (!canUpload) return;
          if (event.detail !== 0) return;
          event.preventDefault();
          handleUpload();
        }}
        disabled={!canUpload}
        role="menuitem"
      >
        <Icon name="document-import" size={16} /> Upload
      </button>
      <hr className={styles.separator} />
      <ContextMenuItem icon="view-refresh" onSelect={onRefresh}>
        Refresh
      </ContextMenuItem>
      <hr className={styles.separator} />
      <ContextMenuItem icon="edit-paste" onSelect={onPaste} disabled={!canPaste}>
        Paste
      </ContextMenuItem>
    </ContextMenuShell>
  );
}
