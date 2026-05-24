import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Overlay } from '../ui/shared';
import { Select } from '../input/Select';
import { FolderPicker } from '../input/FolderPicker';
import { folderIconUrl } from '../../api/icons';
import type { FileEntry } from '../../api/client';
import type { ConflictPolicy } from '../../api/client';
import { getFiles } from '../../api/client';
import styles from './Dialogs.module.css';

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
} | null;

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

export type TransferDialogState = {
  mode: 'copy' | 'move';
  entries: FileEntry[];
  initialDestination: string;
} | null;

function useDialogEscape(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}

export function ConfirmDialog({ dialog, onClose }: { dialog: NonNullable<ConfirmDialogState>; onClose: () => void }) {
  useDialogEscape(onClose);

  const handleConfirm = () => {
    onClose();
    dialog.onConfirm();
  };

  return (
    <Overlay zIndex={110} onClose={onClose}>
      <div className={`${styles.appDialog} ${styles.appDialogSm}`} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="panel-header">
          <h3 id="confirm-dialog-title">{dialog.title}</h3>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="window-close" size={18} />
          </button>
        </div>
        <p className={styles.dialogMessage}>{dialog.message}</p>
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`${styles.dialogButton} ${dialog.danger ? styles.danger : styles.primary}`}
            onClick={handleConfirm}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function TextInputDialog({ dialog, onClose }: { dialog: NonNullable<TextInputDialogState>; onClose: () => void }) {
  const [value, setValue] = useState(dialog.initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogEscape(onClose);

  const handleSubmit = () => {
    if (!value.trim()) {
      setError('Value is required.');
      return;
    }
    onClose();
    dialog.onSubmit(value);
  };

  return (
    <Overlay zIndex={110} onClose={onClose}>
      <div className={styles.appDialog} role="dialog" aria-modal="true" aria-labelledby="text-dialog-title">
        <div className="panel-header">
          <h3 id="text-dialog-title">{dialog.title}</h3>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="window-close" size={18} />
          </button>
        </div>
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
            onKeyDown={(event) => { if (event.key === 'Enter') handleSubmit(); }}
          />
        </label>
        {error && <p className={styles.dialogError}>{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={onClose}>Cancel</button>
          <button type="button" className={`${styles.dialogButton} ${styles.primary}`} onClick={handleSubmit}>{dialog.confirmLabel}</button>
        </div>
      </div>
    </Overlay>
  );
}

export function TransferDialog({
  dialog,
  folderSuggestions,
  onClose,
  onSubmit
}: {
  dialog: NonNullable<TransferDialogState>;
  folderSuggestions: string[];
  onClose: () => void;
  onSubmit: (dialog: TransferDialogState, destinationValue: string, conflictPolicy: ConflictPolicy) => void;
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
  const itemLabel = dialog.entries.length === 1 ? dialog.entries[0].name : `${dialog.entries.length} selected items`;

  useDialogEscape(onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (destination.split('|').map((s) => s.trim()).filter(Boolean).length === 0) {
      setError('Destination folder path is required.');
      return;
    }
    onSubmit(dialog, destination, conflictPolicy);
  };

  const handlePreview = async () => {
    const dests = destination.split('|').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
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
        } else if (conflictPolicy === 'skip') {
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
      <Overlay zIndex={110} onClose={onClose}>
        <div className={`${styles.appDialog} ${styles.appDialogWide}`} role="dialog" aria-modal="true">
          <div className="panel-header">
            <div>
              <h3>Preview {title}</h3>
              <p>{itemLabel} → {destination}</p>
            </div>
            <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
              <Icon name="window-close" size={18} />
            </button>
          </div>
          <div className={styles.previewSummary}>
            {previewSummary.newFiles > 0 && <span className={styles.previewStat}><strong>{previewSummary.newFiles}</strong> new</span>}
            {previewSummary.skipped > 0 && <span className={styles.previewStat}><strong>{previewSummary.skipped}</strong> skipped</span>}
            {previewSummary.overwritten > 0 && <span className={`${styles.previewStat} ${styles.previewStatWarn}`}><strong>{previewSummary.overwritten}</strong> overwritten</span>}
            {previewSummary.renamed > 0 && <span className={`${styles.previewStat} ${styles.previewStatWarn}`}><strong>{previewSummary.renamed}</strong> renamed</span>}
            {previewSummary.cancelled > 0 && <span className={`${styles.previewStat} ${styles.previewStatDanger}`}><strong>{previewSummary.cancelled}</strong> cancelled</span>}
            <span className={styles.previewStatMuted}>· {previewSummary.total} total</span>
          </div>
          <div className={styles.previewItemList}>
            {previewItems.map((item) => {
              let fateClass = styles.fateNew;
              let fateIcon = '✦';
              if (item.fate.startsWith('Skip')) { fateClass = styles.fateSkip; fateIcon = '−'; }
              else if (item.fate.startsWith('Over')) { fateClass = styles.fateOverwrite; fateIcon = '✦'; }
              else if (item.fate.startsWith('Ren')) { fateClass = styles.fateRename; fateIcon = '↻'; }
              else if (item.fate.startsWith('Can')) { fateClass = styles.fateCancel; fateIcon = '✕'; }
              else if (item.fate.startsWith('Ask')) { fateClass = styles.fateAsk; fateIcon = '?'; }
              return (
                <div key={item.name} className={styles.previewItem}>
                  <span className={`${styles.fateBadge} ${fateClass}`}>{fateIcon}</span>
                  <span className={styles.previewItemName}>{item.name}</span>
                  <span className={styles.previewItemFate}>{item.fate}</span>
                </div>
              );
            })}
          </div>
          <div className={styles.dialogActions}>
            <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={() => setPreviewMode(false)}>Go back</button>
            <button
              type="button"
              className={`${styles.dialogButton} ${styles.primary}`}
              onClick={() => onSubmit(dialog, destination, conflictPolicy)}
            >
              Proceed with {actionLabel.toLowerCase()}
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay zIndex={110} onClose={onClose}>
      <form className={styles.appDialog} role="dialog" aria-modal="true" aria-labelledby="transfer-dialog-title" onSubmit={handleSubmit}>
        <div className="panel-header">
          <div>
            <h3 id="transfer-dialog-title">{title}</h3>
            <p>{itemLabel}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close dialog">
            <Icon name="window-close" size={18} />
          </button>
        </div>
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
            <button type="button" className="icon-button" onClick={() => setPickerOpen(true)} title="Browse folders">
              <Icon name="folder-new" size={16} />
            </button>
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
                <button key={path} type="button" onClick={() => {
                  setDestination(path.replace(/\/+$/, '') || '/');
                  setError(null);
                }} title={path}>
                  {path === '/' ? '/' : (path.split('/').filter(Boolean).pop() || path)}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className={styles.dialogField}>
          <span>If a file already exists</span>
          <Select value={conflictPolicy} onChange={(value) => setConflictPolicy(value as ConflictPolicy)}>
            <option value="ask">Ask when needed</option>
            <option value="skip">Skip existing files</option>
            <option value="overwrite">Overwrite existing files</option>
            <option value="rename">Rename new files</option>
            <option value="cancel">Cancel the job</option>
          </Select>
        </label>
        {error && <p className={styles.dialogError}>{error}</p>}
        {previewError && <p className={styles.dialogError}>{previewError}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={onClose}>Cancel</button>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} disabled={previewLoading} onClick={handlePreview}>
            {previewLoading ? 'Scanning...' : 'Preview'}
          </button>
          <button type="submit" className={`${styles.dialogButton} ${styles.primary}`}>{actionLabel}</button>
        </div>
      </form>
    </Overlay>
  );
}
