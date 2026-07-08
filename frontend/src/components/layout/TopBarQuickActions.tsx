import { IconButton } from '../ui/shared';
import { Icon } from '../ui/Icon';
import styles from './TopBarQuickActions.module.css';

export type QuickActionHandlers = {
  onRefresh?: () => void;
  onUpload?: () => void;
  onCreateFolder?: () => void;
  onPaste?: () => void;
};

type TopBarQuickActionsProps = {
  handlers: QuickActionHandlers;
  canUpload?: boolean;
  canPaste?: boolean;
};

export function TopBarQuickActions({ handlers, canUpload, canPaste }: TopBarQuickActionsProps) {
  const { onRefresh, onUpload, onCreateFolder, onPaste } = handlers;

  return (
    <div className={styles.actions}>
      {onRefresh && (
        <IconButton
          className={styles.actionButton}
          onClick={onRefresh}
          title="Refresh"
          aria-label="Refresh"
        >
          <Icon name="view-refresh" size={16} />
        </IconButton>
      )}
      {onUpload && (
        <IconButton
          className={styles.actionButton}
          onClick={onUpload}
          title="Upload"
          aria-label="Upload"
          disabled={!canUpload}
        >
          <Icon name="document-import" size={16} />
        </IconButton>
      )}
      {onCreateFolder && (
        <IconButton
          className={styles.actionButton}
          onClick={onCreateFolder}
          title="New folder"
          aria-label="New folder"
        >
          <Icon name="folder-new" size={16} />
        </IconButton>
      )}
      {onPaste && (
        <IconButton
          className={styles.actionButton}
          onClick={onPaste}
          title="Paste"
          aria-label="Paste"
          disabled={!canPaste}
        >
          <Icon name="edit-paste" size={16} />
        </IconButton>
      )}
    </div>
  );
}
