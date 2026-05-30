import { Icon } from '../ui/Icon';
import { ContextMenuShell } from './ContextMenuShell';
import styles from './ContextMenu.module.css';

interface FilesEmptyMenuProps {
  x: number;
  y: number;
  canWrite: boolean;
  canPaste: boolean;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onUpload: () => void;
  onRefresh: () => void;
  onPaste: () => void;
  onClose: () => void;
}

export function FilesEmptyMenu({
  x, y, canWrite, canPaste,
  onCreateFolder, onCreateFile, onUpload, onRefresh, onPaste, onClose,
}: FilesEmptyMenuProps) {
  return (
    <ContextMenuShell x={x} y={y} onClose={onClose}>
      <button type="button" onClick={() => { onCreateFolder(); onClose(); }} disabled={!canWrite} role="menuitem">
        <Icon name="folder-new" size={16} /> New Folder
      </button>
      <button type="button" onClick={() => { onCreateFile(); onClose(); }} disabled={!canWrite} role="menuitem">
        <Icon name="document-new" size={16} /> New Text File
      </button>
      <button type="button" onClick={() => { onUpload(); onClose(); }} disabled={!canWrite} role="menuitem">
        <Icon name="document-import" size={16} /> Upload
      </button>
      <hr className={styles.separator} />
      <button type="button" onClick={() => { onRefresh(); onClose(); }} role="menuitem">
        <Icon name="view-refresh" size={16} /> Refresh
      </button>
      <hr className={styles.separator} />
      <button type="button" onClick={() => { onPaste(); }} disabled={!canPaste} role="menuitem">
        <Icon name="edit-paste" size={16} /> Paste
      </button>
    </ContextMenuShell>
  );
}
