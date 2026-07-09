import { Dialog } from './Dialog';
import { Button } from '../ui/shared';
import styles from './Dialogs.module.css';

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
} | null;

export function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: NonNullable<ConfirmDialogState>;
  onClose: () => void;
}) {
  const handleConfirm = () => {
    onClose();
    dialog.onConfirm();
  };

  return (
    <Dialog
      title={dialog.title}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button size="compact" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="compact"
            variant={dialog.danger ? 'danger' : 'primary'}
            onClick={handleConfirm}
          >
            {dialog.confirmLabel}
          </Button>
        </>
      }
    >
      <p className={styles.dialogMessage}>{dialog.message}</p>
    </Dialog>
  );
}
