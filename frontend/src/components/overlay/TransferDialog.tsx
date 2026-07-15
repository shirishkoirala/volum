import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton } from '../ui/shared';
import { Dialog } from './Dialog';
import { Select } from '../input/Select';
import { FolderPicker } from '../input/FolderPicker';
import type { FileEntry } from '../../api/client';
import type { ConflictPolicy } from '../../api/client';
import { getFiles } from '../../api/client';
import styles from './Dialogs.module.css';

export type TransferDialogState = {
  mode: 'copy' | 'move';
  entries: FileEntry[];
  initialDestination: string;
} | null;

export function TransferDialog({
  dialog,
  folderSuggestions,
  onClose,
  onSubmit,
}: {
  dialog: NonNullable<TransferDialogState>;
  folderSuggestions: string[];
  onClose: () => void;
  onSubmit: (
    dialog: TransferDialogState,
    destinationValue: string,
    conflictPolicy: ConflictPolicy,
  ) => void;
}) {
  const [destination, setDestination] = useState(dialog.initialDestination);
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('ask');
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewItems, setPreviewItems] = useState<{ name: string; fate: string }[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const title = dialog.mode === 'copy' ? 'Copy Items' : 'Move Items';
  const actionLabel = dialog.mode === 'copy' ? 'Copy' : 'Move';
  const itemLabel =
    dialog.entries.length === 1
      ? dialog.entries[0]!.name
      : `${dialog.entries.length} selected items`;
  const supportsSkipIdentical =
    dialog.mode === 'copy' && dialog.entries.every((entry) => entry.type === 'file');

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (!supportsSkipIdentical && conflictPolicy === 'skip_identical') {
      setConflictPolicy('ask');
    }
  }, [conflictPolicy, supportsSkipIdentical]);

  const handleSubmit = () => {
    if (
      destination
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean).length === 0
    ) {
      setError('Destination folder path is required.');
      return;
    }
    onSubmit(dialog, destination, conflictPolicy);
  };

  const handlePreview = async () => {
    const dests = destination
      .split('|')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    if (dests.length === 0) {
      setError('Destination folder path is required.');
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setError(null);
    try {
      const existingNames = new Set<string>();
      for (const dest of dests) {
        const response = await getFiles(dest, false);
        (response.entries ?? []).forEach((e) => existingNames.add(e.name));
      }
      const items = dialog.entries.map((entry) => {
        const conflict = existingNames.has(entry.name);
        let fate: string;
        if (!conflict) {
          fate = 'New file';
        } else if (conflictPolicy === 'skip' || conflictPolicy === 'skip_identical') {
          fate = 'Skipped (file exists)';
        } else if (conflictPolicy === 'overwrite') {
          fate = 'Overwritten (file exists)';
        } else if (conflictPolicy === 'rename') {
          fate = 'Renamed (file exists)';
        } else if (conflictPolicy === 'cancel') {
          fate = 'Cancel job (file exists)';
        } else {
          fate = 'Ask when needed';
        }
        return { name: entry.name, fate };
      });
      setPreviewItems(items);
      setPreviewMode(true);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to preview destination');
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewSummary = useMemo(() => {
    if (!previewItems) return null;
    const total = previewItems.length;
    const newFiles = previewItems.filter((i) => i.fate === 'New file').length;
    const skipped = previewItems.filter((i) => i.fate.startsWith('Skipped')).length;
    const overwritten = previewItems.filter((i) => i.fate.startsWith('Overwritten')).length;
    const renamed = previewItems.filter((i) => i.fate.startsWith('Renamed')).length;
    const cancelled = previewItems.filter((i) => i.fate.startsWith('Cancel')).length;
    return { total, newFiles, skipped, overwritten, renamed, cancelled };
  }, [previewItems]);

  if (previewMode && previewItems && previewSummary) {
    return (
      <Dialog
        title={`Preview ${title}`}
        subtitle={`${itemLabel} → ${destination}`}
        onClose={onClose}
        width="lg"
        footer={
          <>
            <Button size="compact" onClick={() => setPreviewMode(false)}>
              Go back
            </Button>
            <Button
              size="compact"
              variant="primary"
              onClick={() => onSubmit(dialog, destination, conflictPolicy)}
            >
              Proceed with {actionLabel.toLowerCase()}
            </Button>
          </>
        }
      >
        <div className={styles.previewSummary}>
          {previewSummary.newFiles > 0 && (
            <span className={styles.previewStat}>
              <strong>{previewSummary.newFiles}</strong> new
            </span>
          )}
          {previewSummary.skipped > 0 && (
            <span className={styles.previewStat}>
              <strong>{previewSummary.skipped}</strong> skipped
            </span>
          )}
          {previewSummary.overwritten > 0 && (
            <span className={`${styles.previewStat} ${styles.previewStatWarn}`}>
              <strong>{previewSummary.overwritten}</strong> overwritten
            </span>
          )}
          {previewSummary.renamed > 0 && (
            <span className={`${styles.previewStat} ${styles.previewStatWarn}`}>
              <strong>{previewSummary.renamed}</strong> renamed
            </span>
          )}
          {previewSummary.cancelled > 0 && (
            <span className={`${styles.previewStat} ${styles.previewStatDanger}`}>
              <strong>{previewSummary.cancelled}</strong> cancelled
            </span>
          )}
          <span className={styles.previewStatMuted}>· {previewSummary.total} total</span>
        </div>
        <div className={styles.previewItemList}>
          {previewItems.map((item) => {
            let fateClass = styles.fateNew;
            let fateIcon = '*';
            if (item.fate.startsWith('Skip')) {
              fateClass = styles.fateSkip;
              fateIcon = '-';
            } else if (item.fate.startsWith('Over')) {
              fateClass = styles.fateOverwrite;
              fateIcon = '*';
            } else if (item.fate.startsWith('Ren')) {
              fateClass = styles.fateRename;
              fateIcon = 'R';
            } else if (item.fate.startsWith('Can')) {
              fateClass = styles.fateCancel;
              fateIcon = 'x';
            } else if (item.fate.startsWith('Ask')) {
              fateClass = styles.fateAsk;
              fateIcon = '?';
            }
            return (
              <div key={item.name} className={styles.previewItem}>
                <span className={`${styles.fateBadge} ${fateClass}`}>{fateIcon}</span>
                <span className={styles.previewItemName}>{item.name}</span>
                <span className={styles.previewItemFate}>{item.fate}</span>
              </div>
            );
          })}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={title}
      subtitle={itemLabel}
      onClose={onClose}
      footer={
        <>
          <Button size="compact" onClick={onClose}>
            Cancel
          </Button>
          <Button size="compact" onClick={handlePreview} disabled={previewLoading}>
            {previewLoading ? 'Scanning...' : 'Preview'}
          </Button>
          <Button size="compact" variant="primary" onClick={handleSubmit}>
            {actionLabel}
          </Button>
        </>
      }
    >
      <label className={styles.dialogField}>
        <span>Destination folder path</span>
        <div className={styles.dialogFieldRow}>
          <input
            ref={inputRef}
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              setError(null);
            }}
            placeholder="/path/to/folder"
          />
          <IconButton onClick={() => setPickerOpen(true)} title="Browse folders">
            <Icon name="folder-new" size={16} />
          </IconButton>
        </div>
      </label>
      <p className={styles.dialogHelp}>Use | to send items to multiple destinations.</p>
      {pickerOpen && (
        <FolderPicker
          initialPath={destination}
          onSelect={(path) => {
            setDestination(path);
            setError(null);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {!pickerOpen && folderSuggestions.length > 0 && (
        <div className={styles.dialogSuggestions}>
          <span>Choose destination</span>
          <div>
            {folderSuggestions.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => {
                  setDestination(path.replace(/\/+$/, '') || '/');
                  setError(null);
                }}
                title={path}
              >
                {path === '/' ? '/' : path.split('/').filter(Boolean).pop() || path}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className={styles.dialogField}>
        <span>If a file already exists</span>
        <Select
          value={conflictPolicy}
          onChange={(value) => setConflictPolicy(value as ConflictPolicy)}
        >
          <option value="ask">Ask when needed</option>
          <option value="skip">Skip existing files</option>
          {supportsSkipIdentical && (
            <option value="skip_identical">Skip identical files (by size + checksum)</option>
          )}
          <option value="overwrite">Overwrite existing files</option>
          <option value="rename">Rename new files</option>
          <option value="cancel">Cancel the job</option>
        </Select>
      </label>
      {error && <p className={styles.dialogError}>{error}</p>}
      {previewError && <p className={styles.dialogError}>{previewError}</p>}
    </Dialog>
  );
}
