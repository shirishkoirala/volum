import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/shared';
import styles from './Dialogs.module.css';

export type TextInputDialogState = {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  folderSuggestions?: string[];
  suggestionLabel?: string;
  applyFolderSuggestion?: (path: string) => string;
  onSubmit: (value: string) => void;
} | null;

export function TextInputDialog({
  dialog,
  onClose,
}: {
  dialog: NonNullable<TextInputDialogState>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(dialog.initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!value.trim()) {
      setError('Value is required.');
      return;
    }
    onClose();
    dialog.onSubmit(value);
  };

  return (
    <Dialog
      title={dialog.title}
      onClose={onClose}
      footer={
        <>
          <Button size="compact" onClick={onClose}>
            Cancel
          </Button>
          <Button size="compact" variant="primary" onClick={handleSubmit}>
            {dialog.confirmLabel}
          </Button>
        </>
      }
    >
      <label className={styles.dialogField}>
        <span>{dialog.label}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder={dialog.placeholder}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
          }}
        />
      </label>
      {error && <p className={styles.dialogError}>{error}</p>}
    </Dialog>
  );
}
