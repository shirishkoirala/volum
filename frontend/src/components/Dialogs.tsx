import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Overlay } from './shared';
import type { FileEntry } from '../api/client';
import type { ConflictPolicy } from '../api/client';
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

export type Toast = {
  id: number;
  title: string;
  message?: string;
  variant: 'success' | 'error';
};

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

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`${dialog.label} is required.`);
      return;
    }
    dialog.onSubmit(trimmed);
    onClose();
  };

  return (
    <Overlay zIndex={110} onClose={onClose}>
      <form className={`${styles.appDialog} ${styles.appDialogSm}`} role="dialog" aria-modal="true" aria-labelledby="text-dialog-title" onSubmit={handleSubmit}>
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
            placeholder={dialog.placeholder}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
          />
        </label>
        {dialog.folderSuggestions && dialog.folderSuggestions.length > 0 && (
          <FolderSuggestions
            label={dialog.suggestionLabel ?? 'Folders'}
            paths={dialog.folderSuggestions}
            onSelect={(path) => {
              setValue(dialog.applyFolderSuggestion ? dialog.applyFolderSuggestion(path) : path.replace(/\/+$/, '') || '/');
              setError(null);
            }}
          />
        )}
        {error && <p className={styles.dialogError}>{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${styles.dialogButton} ${styles.primary}`}>{dialog.confirmLabel}</button>
        </div>
      </form>
    </Overlay>
  );
}

export function FolderPicker({
  initialPath,
  onSelect,
  onClose,
}: {
  initialPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [currentDir, setCurrentDir] = useState(initialPath);
  const [subdirs, setSubdirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const pathParts = currentDir.split('/').filter(Boolean);

  const loadSubdirs = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ path, hidden: 'false' });
      const response = await fetch(`/api/files?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load folder (${response.status})`);
      }
      const data = await response.json();
      const dirs: string[] = (data.entries ?? [])
        .filter((e: { type: string }) => e.type === 'directory')
        .map((e: { path: string }) => e.path);
      setSubdirs(dirs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
      setSubdirs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubdirs(currentDir);
  }, [currentDir]);

  const navigateTo = (path: string) => {
    setHistory((prev) => [...prev, currentDir]);
    setCurrentDir(path);
  };

  const goUp = () => {
    if (pathParts.length <= 1) {
      const rootPath = currentDir.startsWith('/') ? '/' : '';
      setCurrentDir(rootPath);
      return;
    }
    const parent = '/' + pathParts.slice(0, -1).join('/');
    setCurrentDir(parent);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentDir(prev);
  };

  return (
    <div className={styles.folderPicker}>
      <div className={styles.folderPickerHeader}>
        <span className={styles.folderPickerTitle}>Select destination</span>
        <div className={styles.folderPickerNav}>
          <button type="button" className="icon-button" onClick={goBack} disabled={history.length === 0} title="Back">
            <span className="icon-rotate-180"><Icon name="go-next" size={16} /></span>
          </button>
          <button type="button" className="icon-button" onClick={goUp} disabled={currentDir === '/'} title="Up">
            <span className="icon-rotate-90"><Icon name="go-next" size={16} /></span>
          </button>
          <button type="button" className="icon-button" onClick={() => loadSubdirs(currentDir)} title="Refresh">
            <Icon name="view-refresh" size={16} />
          </button>
        </div>
      </div>
      <div className={styles.folderPickerBreadcrumb}>
        {pathParts.length === 0 ? (
          <span className={`${styles.folderPickerCrumb} ${styles.folderPickerCrumbActive}`}>/</span>
        ) : (
          <>
            <button
              type="button"
              className={styles.folderPickerCrumb}
              onClick={() => setCurrentDir('/')}
            >
              /
            </button>
            {pathParts.map((part, index) => {
              const path = '/' + pathParts.slice(0, index + 1).join('/');
              const isLast = index === pathParts.length - 1;
              return (
                <span key={path} className={styles.folderPickerCrumbRow}>
                  <Icon name="go-next" size={12} />
                  <button
                    type="button"
                    className={`${styles.folderPickerCrumb}${isLast ? ` ${styles.folderPickerCrumbActive}` : ''}`}
                    onClick={() => isLast ? null : setCurrentDir(path)}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </>
        )}
      </div>
      <div className={styles.folderPickerBody}>
        {loading ? (
          <div className={styles.folderPickerLoading}>Loading...</div>
        ) : error ? (
          <div className={styles.folderPickerError}>{error}</div>
        ) : subdirs.length === 0 ? (
          <div className={styles.folderPickerEmpty}>No subdirectories</div>
        ) : (
          subdirs.map((dir) => {
            const dirName = dir.split('/').filter(Boolean).pop() || dir;
            return (
              <button
                key={dir}
                type="button"
                className={styles.folderPickerItem}
                onDoubleClick={() => navigateTo(dir)}
                onClick={() => onSelect(dir)}
                title={dir}
              >
                <Icon name="folder-new" size={18} />
                <span className={styles.folderPickerItemName}>{dirName}</span>
              </button>
            );
          })
        )}
      </div>
      <div className={styles.folderPickerFooter}>
        <span className={styles.folderPickerPath}>{currentDir}</span>
        <div className={styles.folderPickerActions}>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`${styles.dialogButton} ${styles.primary}`}
            onClick={() => onSelect(currentDir)}
          >
            Choose
          </button>
        </div>
      </div>
    </div>
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
          <FolderSuggestions
            label="Choose destination"
            paths={folderSuggestions}
            onSelect={(path) => {
              setDestination(path.replace(/\/+$/, '') || '/');
              setError(null);
            }}
          />
        )}
        <label className={styles.dialogField}>
          <span>If a file already exists</span>
          <select value={conflictPolicy} onChange={(event) => setConflictPolicy(event.target.value as ConflictPolicy)}>
            <option value="ask">Ask when needed</option>
            <option value="skip">Skip existing files</option>
            <option value="overwrite">Overwrite existing files</option>
            <option value="rename">Rename new files</option>
            <option value="cancel">Cancel the job</option>
          </select>
        </label>
        {error && <p className={styles.dialogError}>{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={`${styles.dialogButton} ${styles.secondary}`} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${styles.dialogButton} ${styles.primary}`}>{actionLabel}</button>
        </div>
      </form>
    </Overlay>
  );
}

export function FolderSuggestions({
  label,
  paths,
  onSelect
}: {
  label: string;
  paths: string[];
  onSelect: (path: string) => void;
}) {
  return (
    <div className={styles.dialogSuggestions}>
      <span>{label}</span>
      <div>
        {paths.map((path) => (
          <button key={path} type="button" onClick={() => onSelect(path)} title={path}>
            {path === '/' ? '/' : (path.split('/').filter(Boolean).pop() || path)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`${styles.toast} ${toast.variant === 'success' ? styles.toastSuccess : styles.toastError}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            {toast.message && <span>{toast.message}</span>}
          </div>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            <Icon name="window-close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
