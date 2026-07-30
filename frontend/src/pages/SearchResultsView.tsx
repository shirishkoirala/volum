import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, FileIcon } from '../components/ui/Icon';
import { AppPanel } from '../components/layout/AppPanel';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { FileContextMenu } from '../components/overlay/FileContextMenu';
import { ConfirmDialog } from '../components/overlay/ConfirmDialog';
import { TextInputDialog } from '../components/overlay/TextInputDialog';
import { TransferDialog } from '../components/overlay/TransferDialog';
import { ShareDialog } from '../components/overlay/ShareDialog';
import { InfoPanel } from '../components/overlay/InfoPanel';
import { PreviewModal } from '../components/overlay/PreviewModal';
import { Skeleton } from '../components/ui/Skeleton';
import { useShellContext } from '../contexts/ShellContext';
import { usePreviewNavigation } from '../hooks/usePreviewNavigation';
import { isPreviewableFile, openFileExternally } from '../utils/preview';
import { joinPath } from '../utils/path';
import { formatBytes, formatGridDate } from '../utils/format';
import { isArchiveFile } from '../utils/archive';
import { shareUrl } from '../api/client-base';
import type { Session } from '../api/client-auth';
import {
  searchFiles,
  deletePath,
  renamePath,
  type SearchResult,
  type FileEntry,
} from '../api/client-files';
import { createJob, type ConflictPolicy } from '../api/client-jobs';
import { createShare } from '../api/client-shares';
import type { ConfirmDialogState } from '../components/overlay/ConfirmDialog';
import type { TextInputDialogState } from '../components/overlay/TextInputDialog';
import type { TransferDialogState } from '../components/overlay/TransferDialog';
import styles from './SearchResultsView.module.css';

function searchResultToFileEntry(result: SearchResult): FileEntry {
  return {
    name: result.name,
    path: result.path,
    type: result.type,
    size: result.size,
    modifiedAt: result.modifiedAt,
    permissions: '',
    owner: '',
    group: '',
    hidden: false,
  };
}

type SearchResultsViewProps = {
  initialQuery?: string;
  session: Session;
  onNavigate: (path: string) => void;
  onClose: () => void;
  onPreview?: (entry: FileEntry, entries?: FileEntry[]) => void;
};

export function SearchResultsView({
  initialQuery = '',
  session,
  onNavigate,
  onClose,
  onPreview,
}: SearchResultsViewProps) {
  const shell = useShellContext();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    result: SearchResult;
  } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [infoEntry, setInfoEntry] = useState<FileEntry | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [textInputDialog, setTextInputDialog] = useState<TextInputDialogState>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>(null);
  const [shareDialogPath, setShareDialogPath] = useState<{ path: string; name: string } | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);

  const canWrite = session.role === 'admin';

  useEffect(() => {
    searchRequestRef.current++;
    setQuery(initialQuery);
    setSelectedPaths([]);
  }, [initialQuery]);

  useEffect(() => {
    const requestId = ++searchRequestRef.current;
    let cancelled = false;
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchFiles(query.trim(), 100)
        .then((response) => {
          if (!cancelled && requestId === searchRequestRef.current) {
            setResults(response.results ?? []);
          }
        })
        .catch((err: Error) => {
          if (!cancelled && requestId === searchRequestRef.current) setError(err.message);
        })
        .finally(() => {
          if (!cancelled && requestId === searchRequestRef.current) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const selectedResults = useMemo(
    () => (results ?? []).filter((r) => selectedPaths.includes(r.path)),
    [results, selectedPaths],
  );

  const selectedEntries = useMemo(
    () => selectedResults.map(searchResultToFileEntry),
    [selectedResults],
  );

  const previewableEntries = useMemo(
    () =>
      (results ?? [])
        .filter((r) => r.type === 'file' && isPreviewableFile(r.name))
        .map(searchResultToFileEntry),
    [results],
  );
  const { previewPositionLabel, previousPreviewEntry, nextPreviewEntry } = usePreviewNavigation(
    previewEntry,
    previewableEntries,
  );

  const caps = useMemo(
    () => ({
      canWrite,
      canPreview: selectedEntries.length === 1 && selectedEntries[0]?.type === 'file',
      canInfo: selectedEntries.length === 1,
      canDownload: selectedEntries.length === 1,
      canRename: selectedEntries.length === 1,
      canArchive: selectedEntries.length === 1,
      canExtract:
        selectedEntries.length === 1 &&
        selectedEntries[0]?.type === 'file' &&
        isArchiveFile(selectedEntries[0]?.name ?? ''),
      canChecksum: canWrite && selectedEntries.length === 1,
      canCopy: selectedEntries.length > 0,
      canMove: selectedEntries.length > 0,
      canPaste: canWrite,
      canDelete: selectedEntries.length > 0,
    }),
    [canWrite, selectedEntries],
  );

  const isFavorited = false;

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successTitle?: string) => {
      try {
        await action();
        shell.showToastObj({ title: successTitle ?? 'Done', variant: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        shell.showToastObj({ title: 'Action failed', message, variant: 'error' });
      }
    },
    [shell],
  );

  const reSearch = useCallback(() => {
    if (query.trim().length >= 2) {
      searchFiles(query.trim(), 100)
        .then((response) => setResults(response.results ?? []))
        .catch((err: Error) => setError(err.message));
    }
  }, [query]);

  const handleClick = useCallback(
    (result: SearchResult) => {
      if (result.type === 'directory') {
        onClose();
        onNavigate(result.path);
      } else if (isPreviewableFile(result.name)) {
        const entry = searchResultToFileEntry(result);
        if (onPreview) {
          onPreview(entry, previewableEntries);
        } else {
          setPreviewEntry(entry);
        }
      } else {
        openFileExternally(result.path);
      }
    },
    [onNavigate, onClose, onPreview, previewableEntries],
  );

  const handleContextMenu = useCallback(
    (result: SearchResult, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus();
      if (!selectedPaths.includes(result.path)) {
        setSelectedPaths([result.path]);
      }
      setContextMenu({ x: event.clientX, y: event.clientY, result });
    },
    [selectedPaths],
  );

  const handlePreview = useCallback(() => {
    const entry = selectedEntries[0];
    if (selectedEntries.length !== 1 || !entry || entry.type !== 'file') return;
    if (isPreviewableFile(entry.name)) {
      if (onPreview) {
        onPreview(entry, previewableEntries);
      } else {
        setPreviewEntry(entry);
      }
    } else {
      openFileExternally(entry.path);
    }
  }, [selectedEntries, onPreview, previewableEntries]);

  const handleShowInfo = useCallback(() => {
    if (selectedEntries.length !== 1) return;
    setInfoEntry(selectedEntries[0] ?? null);
  }, [selectedEntries]);

  const handleDownload = useCallback(() => {
    const entry = selectedEntries[0];
    if (!entry) return;
    setConfirmDialog({
      title: 'Download File?',
      message: `Download "${entry.name}"? This will open the file in a new browser tab.`,
      confirmLabel: 'Download',
      onConfirm: () => openFileExternally(entry.path),
    });
  }, [selectedEntries]);

  const handleRename = useCallback(() => {
    const entry = selectedEntries[0];
    if (!entry) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Rename',
      label: 'New name',
      placeholder: entry.name,
      initialValue: entry.name,
      confirmLabel: 'Rename',
      onSubmit: (value: string) => {
        void runAction(async () => {
          await renamePath(entry.path, value.trim());
          reSearch();
        }, 'Item renamed');
      },
    });
  }, [selectedEntries, runAction, reSearch]);

  const handleDelete = useCallback(() => {
    if (selectedResults.length === 0) return;
    const entriesToDelete = [...selectedResults];
    const label =
      entriesToDelete.length === 1
        ? `"${entriesToDelete[0]!.name}"`
        : `${entriesToDelete.length} selected items`;
    setConfirmDialog({
      title: 'Move to Trash',
      message: `Move ${label} to trash?`,
      confirmLabel: 'Move to Trash',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          for (const entry of entriesToDelete) await deletePath(entry.path, entry.name);
          setSelectedPaths([]);
          reSearch();
        }, 'Queued for trash');
      },
    });
  }, [selectedResults, runAction, reSearch]);

  const handleCopy = useCallback(() => {
    if (selectedResults.length === 0) return;
    setContextMenu(null);
    setTransferDialog({
      mode: 'copy',
      entries: selectedEntries,
      initialDestination: '/',
    });
  }, [selectedResults, selectedEntries]);

  const handleMove = useCallback(() => {
    if (selectedResults.length === 0) return;
    setContextMenu(null);
    setTransferDialog({
      mode: 'move',
      entries: selectedEntries,
      initialDestination: '/',
    });
  }, [selectedResults, selectedEntries]);

  const handleQuickShare = useCallback(async () => {
    const entry = contextMenu?.result;
    if (!entry) return;
    setContextMenu(null);
    let url: string;
    try {
      const share = await createShare({ path: entry.path });
      url = shareUrl(share.token);
    } catch (err) {
      shell.showToastObj({
        title: 'Quick share failed',
        message: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      shell.showToastObj({ title: 'Share link copied to clipboard', variant: 'success' });
    } catch {
      shell.showToastObj({
        title: 'Share link created, but not copied',
        message: 'Open Manage Shares to copy the link.',
        variant: 'warning',
      });
    }
  }, [contextMenu, shell]);

  const handleShare = useCallback(() => {
    const entry = selectedResults[0];
    if (!entry) return;
    setShareDialogPath({ path: entry.path, name: entry.name });
  }, [selectedResults]);

  const handleArchive = useCallback(() => {
    const entry = selectedResults[0];
    if (!entry) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Create Archive',
      label: 'Archive name',
      placeholder: `${entry.name}.zip`,
      confirmLabel: 'Create',
      onSubmit: (value: string) => {
        void runAction(async () => {
          await createJob({
            type: 'archive',
            sourcePath: entry.path,
            destinationPath: value.trim(),
          });
        }, 'Archive job created');
      },
    });
  }, [selectedResults, runAction]);

  const handleExtract = useCallback(() => {
    const entry = selectedResults[0];
    if (!entry) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Extract Archive',
      label: 'Destination folder',
      placeholder: entry.path.replace(/\.(zip|tar|tar\.gz|tgz)$/i, ''),
      confirmLabel: 'Extract',
      onSubmit: (value: string) => {
        void runAction(async () => {
          await createJob({
            type: 'extract',
            sourcePath: entry.path,
            destinationPath: value.trim(),
          });
        }, 'Extract job created');
      },
    });
  }, [selectedResults, runAction]);

  const handleChecksum = useCallback(() => {
    const entry = selectedResults[0];
    if (!entry) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Checksum',
      label: 'Algorithm (md5, sha256)',
      placeholder: 'sha256',
      confirmLabel: 'Start',
      onSubmit: (value: string) => {
        void runAction(async () => {
          await createJob({ type: 'checksum', sourcePath: entry.path, verifyMode: value.trim() });
        }, 'Checksum job created');
      },
    });
  }, [selectedResults, runAction]);

  const handleTransferSubmit = useCallback(
    (dialog: TransferDialogState, destinationValue: string, conflictPolicy: ConflictPolicy) => {
      if (!dialog) return;
      const destinations = destinationValue
        .split('|')
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean);
      if (destinations.length === 0) return;
      setTransferDialog(null);
      void runAction(
        async () => {
          for (const entry of dialog.entries) {
            for (const dest of destinations) {
              await createJob({
                type: dialog.mode === 'copy' ? 'copy' : 'move',
                sourcePath: entry.path,
                destinationPath: joinPath(dest, entry.name),
                conflictPolicy,
                verifyMode: 'size',
              });
            }
          }
          reSearch();
        },
        dialog.mode === 'copy' ? 'Copy transfer started' : 'Move transfer started',
      );
    },
    [runAction, reSearch],
  );

  const handleClearSearch = useCallback(() => {
    searchRequestRef.current++;
    setQuery('');
    setResults(null);
    setSelectedPaths([]);
    setError(null);
    searchInputRef.current?.focus();
  }, []);

  const entryCount = results?.length ?? 0;

  return (
    <AppPanel className={styles.searchView} padding="none" scroll={false}>
      <div className={styles.searchHeader}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="Back">
          <Icon name="go-previous" size={18} />
        </button>
        <div className={styles.searchInputWrap}>
          <Icon name="edit-find" size={16} />
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            aria-label="Search files across all roots"
            aria-controls="search-results"
            placeholder="Search files across all roots..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedPaths([]);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleClearSearch();
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <Icon name="window-close" size={14} />
            </button>
          )}
        </div>
      </div>

      {query.trim().length >= 2 && !loading && results && (
        <div className={styles.resultMeta} role="status" aria-live="polite">
          {entryCount} result{entryCount === 1 ? '' : 's'} for <strong>"{query.trim()}"</strong>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div id="search-results" className={styles.resultsArea} aria-busy={loading}>
        {loading ? (
          <div role="status" aria-label="Searching files">
            <Skeleton variant="row" count={8} />
          </div>
        ) : query.trim().length < 2 ? (
          <EmptyState
            title="Search files"
            subtitle="Type at least 2 characters to search across all roots"
          />
        ) : results && results.length === 0 ? (
          <EmptyState
            title="No results found"
            subtitle={`No files or folders match "${query.trim()}"`}
          />
        ) : results ? (
          <div className={styles.resultsList}>
            {results.map((result) => {
              const isSelected = selectedPaths.includes(result.path);
              const entry = searchResultToFileEntry(result);
              return (
                <button
                  type="button"
                  key={result.path}
                  className={`${styles.resultRow}${isSelected ? ` ${styles.selected}` : ''}`}
                  onClick={() => handleClick(result)}
                  onFocus={() => setSelectedPaths([result.path])}
                  onContextMenu={(e) => handleContextMenu(result, e)}
                >
                  <FileIcon entry={entry} size={20} />
                  <span className={styles.resultName}>{result.name}</span>
                  <span className={styles.resultPath}>{result.path}</span>
                  <span className={styles.resultSize}>{formatBytes(result.size)}</span>
                  <span className={styles.resultDate}>{formatGridDate(result.modifiedAt)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          caps={caps}
          isFavorited={isFavorited}
          selectedCount={selectedResults.length}
          onPreview={handlePreview}
          onShowInfo={handleShowInfo}
          onDownload={handleDownload}
          onRename={handleRename}
          onBatchRename={() => {}}
          onCopy={handleCopy}
          onMove={handleMove}
          onArchive={handleArchive}
          onExtract={handleExtract}
          onChecksum={handleChecksum}
          onPaste={() => {}}
          onQuickShare={handleQuickShare}
          onShare={handleShare}
          onToggleFavorite={() => {}}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}
      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onDownload={() => openFileExternally(previewEntry.path)}
          onShare={
            canWrite
              ? () => setShareDialogPath({ path: previewEntry.path, name: previewEntry.name })
              : undefined
          }
          onPrevious={
            previousPreviewEntry ? () => setPreviewEntry(previousPreviewEntry) : undefined
          }
          onNext={nextPreviewEntry ? () => setPreviewEntry(nextPreviewEntry) : undefined}
          previousDisabled={!previousPreviewEntry}
          nextDisabled={!nextPreviewEntry}
          positionLabel={previewPositionLabel}
        />
      )}
      {infoEntry && (
        <InfoPanel entry={infoEntry} onClose={() => setInfoEntry(null)} onRefresh={() => {}} />
      )}
      {confirmDialog && (
        <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      )}
      {textInputDialog && (
        <TextInputDialog dialog={textInputDialog} onClose={() => setTextInputDialog(null)} />
      )}
      {transferDialog && (
        <TransferDialog
          dialog={transferDialog}
          folderSuggestions={['/']}
          onClose={() => setTransferDialog(null)}
          onSubmit={handleTransferSubmit}
        />
      )}
      {canWrite && shareDialogPath && (
        <ShareDialog
          path={shareDialogPath.path}
          name={shareDialogPath.name}
          onClose={() => setShareDialogPath(null)}
        />
      )}
    </AppPanel>
  );
}
