import { KeyboardEvent, MouseEvent, RefObject, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { EmptyState } from '../components/ui/EmptyState';
import { FileSearchBar } from '../components/ui/FileSearchBar';
import { FileGridView } from '../components/ui/FileGridView';
import { FileListView } from '../components/ui/FileListView';
import { KeyboardShortcuts } from '../components/overlay/KeyboardShortcuts';
import { PreviewModal } from '../components/overlay/PreviewModal';
import { InfoPanel } from '../components/overlay/InfoPanel';
import { BatchRenameModal } from '../components/overlay/BatchRenameModal';
import { ShareDialog } from '../components/overlay/ShareDialog';
import { ShareManager } from '../components/overlay/ShareManager';
import { DiskUsageAnalyzer } from '../components/overlay/DiskUsageAnalyzer';
import { ConfirmDialog, TextInputDialog, TransferDialog } from '../components/overlay/Dialogs';
import { FileContextMenu } from '../components/overlay/FileContextMenu';
import { TrashContextMenu } from '../components/overlay/TrashContextMenu';
import { FilesEmptyMenu } from '../components/overlay/FilesEmptyMenu';
import { ProgressBar } from '../components/ui/ProgressBar';
import { folderIconUrl } from '../api/icons';
import { useWindowId, useCommandsContext } from '../contexts/WindowCommands';
import type { FileEntry, Session } from '../api/client';
import { isPreviewableFile } from '../utils/preview';
import { useFileBrowser } from '../hooks/useFileBrowser';
import { useFileActions } from '../hooks/useFileActions';
import { useFileCommands } from '../hooks/useFileCommands';
import { useSelection } from '../hooks/useSelection';
import { useViewPreferences } from '../hooks/useViewPreferences';
import { useDialogStack } from '../hooks/useDialogStack';
import { useContextMenus } from '../hooks/useContextMenus';
import { useDragDrop } from '../hooks/useDragDrop';
import { useRubberBand } from '../hooks/useRubberBand';
import { useNavStack } from '../hooks/useNavStack';
import { useShellContext } from '../contexts/ShellContext';
import type { UploadProgress } from '../utils/upload';
import { formatBytes } from '../utils/format';
import styles from './FilesView.module.css';

type FilesViewProps = {
  currentPath: string;
  session: Session;
  favorites: string[];
  onNavigate: (path: string) => void;
  onBack: () => void;
  onAddFavorite: (path: string) => void;
  onRemoveFavorite: (path: string) => void;
  onPreview?: (entry: FileEntry) => void;
};

export type FilesViewHandle = {
  handleSelectAll: () => void;
  handleInvertSelection: () => void;
  handleCreateFolder: () => void;
  handleCreateFile: () => void;
  handleRename: () => void;
  handleDelete: () => void;
  handleUpload: () => void;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleToggleLocation: () => void;
  setClipboardFromSelection: (mode: 'copy' | 'move') => void;
  handleGoUp: () => void;
  handleGoBack: () => void;
};

export const FilesView = forwardRef<FilesViewHandle, FilesViewProps>(function FilesView({ currentPath, session, favorites, onNavigate, onBack, onAddFavorite, onRemoveFavorite, onPreview }, ref) {
  const shell = useShellContext();
  const viewPref = useViewPreferences();
  const windowId = useWindowId();
  const [windowPath, setWindowPath] = useState(currentPath || '/');
  const effectivePath = windowId ? windowPath : viewPref.currentPath;
  const browser = useFileBrowser({ currentPath: effectivePath, showHidden: viewPref.showHidden, session });
  const fileActions = useFileActions();
  const { setPreviewEntry } = fileActions;
  const dialogs = useDialogStack();
  const menus = useContextMenus();
  const { register: registerCommands, unregister: unregisterCommands } = useCommandsContext();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const setPendingUploadCount = useCallback(() => {}, []);
  const fileGridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressEntry = useRef<{ entry: FileEntry; x: number; y: number } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevPropPath = useRef<string | null>(null);
  useEffect(() => {
    if (currentPath !== prevPropPath.current) {
      prevPropPath.current = currentPath;
      if (windowId) setWindowPath(currentPath || '/');
      else viewPref.setCurrentPath(currentPath);
    }
  }, [currentPath, viewPref, windowId]);

  useEffect(() => {
    setPreviewEntry(null);
  }, [effectivePath, setPreviewEntry]);

  const openPreview = useCallback((entry: FileEntry) => {
    if (onPreview) onPreview(entry);
    else setPreviewEntry(entry);
  }, [onPreview, setPreviewEntry]);

  const setPreviewTarget = useCallback((value: React.SetStateAction<FileEntry | null>) => {
    const next = typeof value === 'function' ? value(fileActions.previewEntry) : value;
    if (next) openPreview(next);
    else setPreviewEntry(null);
  }, [fileActions.previewEntry, openPreview, setPreviewEntry]);

  const selection = useSelection({
    filteredEntries: browser.filteredEntries,
    trashEntries: browser.trashEntries,
    favorites,
    canWrite: browser.canWrite,
    currentPath: effectivePath,
  });

  const navActions = useNavStack({
    viewPref: {
      currentPath: effectivePath,
      setCurrentPath: windowId ? setWindowPath : viewPref.setCurrentPath,
      navigateToPath: windowId ? setWindowPath : viewPref.navigateToPath,
    },
    browser: {
      refresh: browser.refresh,
      setSearchOpen: browser.setSearchOpen,
      setSearchResults: browser.setSearchResults,
      setQuery: browser.setQuery,
      setTrashEntries: browser.setTrashEntries,
    },
  });

  const handleNavigate = useCallback((path: string) => {
    navActions.navigateTo(path);
    if (!windowId) onNavigate(path);
  }, [navActions, onNavigate, windowId]);

  const refresh = useCallback(() => {
    navActions.refresh();
  }, [navActions]);

  const fileCommands = useFileCommands({
    currentPath: effectivePath,
    canWrite: browser.canWrite,
    folderSuggestions: browser.folderSuggestions,
    refresh,
    setError: browser.setError,
    setTrashEntries: browser.setTrashEntries,
    setJobs: browser.setJobs,
    selectedEntries: selection.selectedEntries,
    setSelectedPaths: selection.setSelectedPaths,
    setLastSelectedPath: selection.setLastSelectedPath,
    renaming: fileActions.renaming,
    setRenaming: fileActions.setRenaming,
    setContextMenu: fileActions.setContextMenu,
    setPreviewEntry: setPreviewTarget,
    setInfoEntry: fileActions.setInfoEntry,
    setBatchRenameOpen: fileActions.setBatchRenameOpen,
    setAnalyzePath: fileActions.setAnalyzePath,
    fileClipboard: fileActions.fileClipboard,
    setFileClipboard: fileActions.setFileClipboard,
    setConfirmDialog: dialogs.setConfirmDialog,
    setTextInputDialog: dialogs.setTextInputDialog,
    setTransferDialog: dialogs.setTransferDialog,
    setTrashContextMenu: menus.setTrashContextMenu,
    setFilesEmptyMenu: menus.setFilesEmptyMenu,
    setUploadProgress,
    setPendingUploadCount,
    showToastObj: shell.showToastObj,
    contextMenu: fileActions.contextMenu,
    navigateTo: handleNavigate,
    selectedTrashIds: selection.selectedTrashIds,
    setSelectedTrashIds: selection.setSelectedTrashIds,
    setLastSelectedTrashId: selection.setLastSelectedTrashId,
    emptyMenuBlockedRef: menus.emptyMenuBlockedRef,
  });

  const dragDrop = useDragDrop(
    browser.canWrite,
    browser.filteredEntries,
    selection.selectedPaths,
    dialogs.setTransferDialog,
    fileCommands.handleUploadFiles,
    (message) => {
      browser.setError(message);
      shell.showToastObj({ title: 'Upload failed', message, variant: 'error' });
    },
  );

  const { rubberBandStyle, handleFileAreaMouseDown } = useRubberBand(
    browser.filteredEntries, selection.setSelectedPaths, selection.setLastSelectedPath, fileGridRef,
  );

  useEffect(() => { fileCommands.renameInputRef.current?.focus(); fileCommands.renameInputRef.current?.select(); }, [fileActions.renaming, fileCommands.renameInputRef]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); fileActions.setShortcutsOpen((p) => !p); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); browser.setSearchOpen(true); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); fileActions.setLocationMode((v) => !v); }
      if (e.key === 'Escape' && browser.searchOpen) { browser.setSearchOpen(false); browser.setSearchResults(null); browser.setQuery(''); }
      if (e.key === 'Escape' && fileActions.shortcutsOpen) { fileActions.setShortcutsOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [browser, fileActions]);

  useEffect(() => {
    const closeMenus = () => {
      fileActions.setContextMenu(null);
      menus.setTrashContextMenu(null);
      menus.setDesktopContextMenu(null);
      menus.setFilesEmptyMenu(null);
      menus.setTrashEmptyMenu(null);
      menus.setJobsEmptyMenu(null);
    };
    window.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    return () => { window.removeEventListener('click', closeMenus); window.removeEventListener('resize', closeMenus); };
  }, [fileActions, menus]);

  const handleContextMenuEvent = useCallback((entry: FileEntry, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    menus.emptyMenuBlockedRef.current = true;
    queueMicrotask(() => { menus.emptyMenuBlockedRef.current = false; });
    if (fileActions.renaming) return;
    if (!selection.selectedPaths.includes(entry.path)) {
      selection.setSelectedPaths([entry.path]);
      selection.setLastSelectedPath(entry.path);
    }
    fileActions.setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }, [fileActions, selection, menus]);

  const handleFilesEmptyContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (menus.emptyMenuBlockedRef.current) { menus.emptyMenuBlockedRef.current = false; return; }
    event.preventDefault();
    event.stopPropagation();
    fileActions.setContextMenu(null);
    menus.setFilesEmptyMenu({ x: event.clientX, y: event.clientY });
  }, [fileActions, menus]);

  const handleEntryTouchStart = useCallback((entry: FileEntry, event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]!;
    longPressEntry.current = { entry, x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      const lp = longPressEntry.current;
      if (lp) { fileActions.setContextMenu({ x: lp.x, y: lp.y, entry: lp.entry }); longPressEntry.current = null; }
    }, 500);
  }, [fileActions]);

  const handleEntryTouchMove = useCallback(() => {
    longPressEntry.current = null;
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleEntryTouchEnd = useCallback(() => {
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleFileAreaKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    fileCommands.handleFileAreaKeyDown(event);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selection.handleSelectAll();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      selection.handleInvertSelection();
      return;
    }
  }, [fileCommands, selection]);

  const openUploadPicker = useCallback(() => {
    const input = uploadFileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  }, []);

  const canUpload = browser.canWrite && Boolean(effectivePath);

  useImperativeHandle(ref, () => ({
    handleSelectAll: selection.handleSelectAll,
    handleInvertSelection: selection.handleInvertSelection,
    handleCreateFolder: fileCommands.handleCreateFolder,
    handleCreateFile: fileCommands.handleCreateFile,
    handleRename: fileCommands.handleRename,
    handleDelete: fileCommands.handleDelete,
    handleUpload: openUploadPicker,
    handleCut: () => fileCommands.setClipboardFromSelection('move'),
    handleCopy: () => fileCommands.setClipboardFromSelection('copy'),
    handlePaste: fileCommands.handlePaste,
    handleToggleLocation: () => fileActions.setLocationMode((v: boolean) => !v),
    setClipboardFromSelection: fileCommands.setClipboardFromSelection,
    handleGoUp,
    handleGoBack,
  }));

  // Register window commands when inside a window
  useEffect(() => {
    if (!windowId) return;
    registerCommands(windowId, {
      onCreateFolder: fileCommands.handleCreateFolder,
      onUpload: openUploadPicker,
      onCut: () => fileCommands.setClipboardFromSelection('move'),
      onCopy: () => fileCommands.setClipboardFromSelection('copy'),
      onPaste: fileCommands.handlePaste,
      onSelectAll: selection.handleSelectAll,
      onInvertSelection: selection.handleInvertSelection,
      onRename: fileCommands.handleRename,
      onDelete: fileCommands.handleDelete,
      canWrite: browser.canWrite,
      canUpload,
      selectedCount: selection.selectedPaths.length,
    });
    return () => unregisterCommands(windowId);
  }, [windowId, fileCommands, openUploadPicker, selection, browser.canWrite, canUpload, registerCommands, unregisterCommands]);

  const selectedEntryIsFavorited = fileActions.contextMenu?.entry ? favorites.includes(fileActions.contextMenu.entry.path) : selection.isFavorited;

  const curPath = effectivePath;
  const breadcrumbs = browser.breadcrumbs;
  const locationMode = fileActions.locationMode;

  function handleGoBack() {
    navActions.goBack();
    if (!windowId) onBack();
  }

  function handleGoUp() {
    const parts = curPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      handleNavigate('/' + parts.slice(0, -1).join('/'));
    }
  }

  function commitRename(entry: FileEntry) {
    fileCommands.commitRename(entry);
  }

  function renderEntries() {
    const localFilterActive = browser.query.trim().length > 0;
    const totalEntries = localFilterActive ? browser.filteredEntries.length : browser.filePage.total;
    const incrementalResetKey = `${effectivePath}:${viewPref.showHidden}:${browser.query}:${viewPref.viewMode}`;

    if (viewPref.viewMode === 'grid') {
      return (
        <FileGridView
          filteredEntries={browser.filteredEntries}
          selectedPaths={selection.selectedPaths}
          onContextMenu={handleContextMenuEvent}
          onEmptyContextMenu={handleFilesEmptyContextMenu}
          canWrite={browser.canWrite}
          onFileDragStart={dragDrop.handleFileDragStart}
          onFolderDragOver={dragDrop.handleFolderDragOver}
          onFolderDragLeave={dragDrop.handleFolderDragLeave}
          onDropOnFolder={dragDrop.handleDropOnFolder}
          dragOverPath={dragDrop.dragOverPath}
          favorites={favorites}
          renameState={fileActions.renaming}
          renameInputRef={fileCommands.renameInputRef as RefObject<HTMLInputElement | null>}
          onSubmitRename={commitRename}
          onCancelRename={fileCommands.cancelRename}
          onRenameChange={(value) => fileActions.setRenaming({ path: fileActions.renaming?.path ?? '', value })}
          fileGridRef={fileGridRef as RefObject<HTMLDivElement | null>}
          rubberBandStyle={rubberBandStyle}
          fileClick={selection.handleFileClick}
          onFileAreaDragOver={dragDrop.handleFileAreaDragOver}
          onFileAreaDragLeave={dragDrop.handleFileAreaDragLeave}
          onFileAreaDrop={dragDrop.handleFileAreaDrop}
          onFileAreaMouseDown={handleFileAreaMouseDown}
          onFileAreaKeyDown={handleFileAreaKeyDown}
          draggingUpload={dragDrop.draggingUpload}
          totalEntries={totalEntries}
          loadingMore={browser.loadingMore}
          onLoadMoreEntries={localFilterActive ? undefined : browser.loadMoreEntries}
          resetKey={incrementalResetKey}
          onEntryTouchStart={handleEntryTouchStart}
          onEntryTouchMove={handleEntryTouchMove}
          onEntryTouchEnd={handleEntryTouchEnd}
          onNavigate={handleNavigate}
          onPreview={(entry) => {
            if (isPreviewableFile(entry.name)) openPreview(entry);
            else fileCommands.handleDownload(entry);
          }}
        />
      );
    }
    return (
      <FileListView
        filteredEntries={browser.filteredEntries}
        selectedPaths={selection.selectedPaths}
        onContextMenu={handleContextMenuEvent}
        onEmptyContextMenu={handleFilesEmptyContextMenu}
        canWrite={browser.canWrite}
        onFileDragStart={dragDrop.handleFileDragStart}
        onFolderDragOver={dragDrop.handleFolderDragOver}
        onFolderDragLeave={dragDrop.handleFolderDragLeave}
        onDropOnFolder={dragDrop.handleDropOnFolder}
        dragOverPath={dragDrop.dragOverPath}
        favorites={favorites}
        renameState={fileActions.renaming}
        renameInputRef={fileCommands.renameInputRef as RefObject<HTMLInputElement | null>}
        onSubmitRename={commitRename}
        onCancelRename={fileCommands.cancelRename}
        onRenameChange={(value) => fileActions.setRenaming({ path: fileActions.renaming?.path ?? '', value })}
        fileGridRef={fileGridRef as RefObject<HTMLDivElement | null>}
        rubberBandStyle={rubberBandStyle}
        fileClick={selection.handleFileClick}
        onFileAreaDragOver={dragDrop.handleFileAreaDragOver}
        onFileAreaDragLeave={dragDrop.handleFileAreaDragLeave}
        onFileAreaDrop={dragDrop.handleFileAreaDrop}
        onFileAreaMouseDown={handleFileAreaMouseDown}
        onFileAreaKeyDown={handleFileAreaKeyDown}
        draggingUpload={dragDrop.draggingUpload}
        totalEntries={totalEntries}
        loadingMore={browser.loadingMore}
        onLoadMoreEntries={localFilterActive ? undefined : browser.loadMoreEntries}
        resetKey={incrementalResetKey}
        onEntryTouchStart={handleEntryTouchStart}
        onEntryTouchMove={handleEntryTouchMove}
        onEntryTouchEnd={handleEntryTouchEnd}
        onNavigate={handleNavigate}
        onPreview={(entry) => {
          if (isPreviewableFile(entry.name)) openPreview(entry);
          else fileCommands.handleDownload(entry);
        }}
      />
    );
  }

  return (
    <>
      <div className={styles.filesViewContainer}>
        <input
          ref={uploadFileInputRef}
          type="file"
          multiple
          className={styles.hiddenFileInput}
          onChange={(event) => {
            const { files } = event.currentTarget;
            try {
              if (files && files.length > 0) {
                fileCommands.handleUploadFiles(files);
              }
            } finally {
              event.currentTarget.value = '';
            }
          }}
        />
        <div className={styles.fileContent} onContextMenu={handleFilesEmptyContextMenu}>
          <BreadcrumbBar crumbs={breadcrumbs} onBack={handleGoBack} onGoUp={handleGoUp} onNavigate={handleNavigate} locationMode={locationMode} onLocationNavigate={(path: string) => handleNavigate(path.startsWith('/') ? path : `/${path}`)} onToggleLocationMode={() => fileActions.setLocationMode((v) => !v)}>
            <FileSearchBar
              query={browser.query} searchOpen={browser.searchOpen} searchResults={browser.searchResults}
              onSearch={(q) => { browser.setQuery(q); if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => browser.handleGlobalSearch(q), 200); browser.setSearchOpen(true); }}
              onClearSearch={() => { browser.setQuery(''); browser.setSearchResults(null); browser.setSearchOpen(false); }}
              onSearchResultClick={(result) => {
                if (result.type === 'directory') handleNavigate(result.path);
                else { const idx = result.path.lastIndexOf('/'); handleNavigate(idx < 0 ? '/' : result.path.substring(0, idx) || '/'); }
              }}
              onUploadClick={openUploadPicker}
              canUpload={canUpload}
              searchRef={searchRef as React.RefObject<HTMLInputElement | null>}
            />
          </BreadcrumbBar>

          {browser.error && (
            <div className={styles.errorBanner}>
              {browser.error}
              <button type="button" className={styles.errorDismiss} onClick={() => browser.setError(null)} aria-label="Dismiss error">&times;</button>
            </div>
          )}
          {browser.loading ? (
            <div className={styles.skeletonGrid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonIcon} />
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.short}`} />
                </div>
              ))}
            </div>
          ) : browser.filteredEntries.length === 0 ? (
            <div
              className={`${styles.emptyDropZone}${dragDrop.draggingUpload ? ` ${styles.dragOver}` : ''}`}
              onDragOver={dragDrop.handleFileAreaDragOver}
              onDragLeave={dragDrop.handleFileAreaDragLeave}
              onDrop={dragDrop.handleFileAreaDrop}
            >
              <EmptyState icon={folderIconUrl('64')} title="This folder is empty" subtitle={curPath} />
            </div>
          ) : (
            renderEntries()
          )}
        </div>
      </div>

      {fileActions.contextMenu && (
        <FileContextMenu
          x={fileActions.contextMenu.x} y={fileActions.contextMenu.y}
          caps={{
            canWrite: browser.canWrite, canPreview: selection.canPreview,
            canInfo: selection.canInfo, canDownload: selection.canDownload,
            canRename: selection.canRename, canArchive: selection.canArchive,
            canExtract: selection.canExtract, canChecksum: selection.canChecksum,
            canCopy: selection.canCopy, canMove: selection.canMove,
            canPaste: selection.canPaste, canDelete: selection.canDelete,
            canAnalyze: selection.canAnalyze,
          }}
          isFavorited={selectedEntryIsFavorited}
          selectedCount={selection.selectedEntries.length}
          onPreview={fileCommands.handlePreview}
          onShowInfo={fileCommands.handleShowInfo}
          onDownload={fileCommands.handleDownload}
          onRename={fileCommands.handleRename}
          onBatchRename={fileCommands.handleBatchRename}
          onCopy={fileCommands.handleCopy} onMove={fileCommands.handleMove}
          onArchive={fileCommands.handleCreateArchive}
          onExtract={fileCommands.handleExtractArchive}
          onChecksum={fileCommands.handleCreateChecksum}
          onPaste={fileCommands.handlePaste}
          onQuickShare={fileCommands.handleQuickShare}
          onShare={() => {
            const e = fileActions.contextMenu!.entry;
            if (e) dialogs.setShareDialogPath({ path: e.path, name: e.name });
          }}
          onAnalyze={fileCommands.handleAnalyze}
          onToggleFavorite={() => {
            const e = fileActions.contextMenu!.entry;
            if (e) {
              if (favorites.includes(e.path)) onRemoveFavorite(e.path);
              else onAddFavorite(e.path);
            }
          }}
          onDelete={fileCommands.handleDelete}
          onClose={() => fileActions.setContextMenu(null)}
        />
      )}
      {menus.trashContextMenu && browser.canWrite && (
        <TrashContextMenu
          x={menus.trashContextMenu.x} y={menus.trashContextMenu.y}
          onRestore={() => fileCommands.handleRestoreTrash(menus.trashContextMenu!.entry)}
          onDeletePermanently={() => fileCommands.handleDeleteTrash(menus.trashContextMenu!.entry)}
          onClose={() => menus.setTrashContextMenu(null)}
        />
      )}
      {menus.filesEmptyMenu && (
        <FilesEmptyMenu
          x={menus.filesEmptyMenu.x} y={menus.filesEmptyMenu.y}
          canWrite={browser.canWrite}
          canUpload={canUpload}
          canPaste={selection.canPaste}
          onCreateFolder={fileCommands.handleCreateFolder}
          onCreateFile={fileCommands.handleCreateFile}
          onUpload={openUploadPicker}
          onRefresh={refresh}
          onPaste={() => { menus.setFilesEmptyMenu(null); fileCommands.handlePaste(); }}
          onClose={() => menus.setFilesEmptyMenu(null)}
        />
      )}

      {uploadProgress && (
        <div className={styles.uploadProgress} role="status" aria-live="polite">
          <div className={styles.uploadProgressHeader}>
            <strong>Uploading</strong>
            <span>{Math.round(uploadProgress.total > 0 ? (uploadProgress.received / uploadProgress.total) * 100 : 0)}%</span>
          </div>
          <span className={styles.uploadProgressName}>{uploadProgress.filename}</span>
          <ProgressBar
            value={uploadProgress.total > 0 ? (uploadProgress.received / uploadProgress.total) * 100 : 0}
            ariaLabel="Upload progress"
          />
          <span className={styles.uploadProgressMeta}>
            {formatBytes(uploadProgress.received)} of {formatBytes(uploadProgress.total)}
          </span>
        </div>
      )}

      {fileActions.previewEntry && (
        <PreviewModal entry={fileActions.previewEntry} onClose={() => fileActions.setPreviewEntry(null)} onDownload={() => fileCommands.handleDownload(fileActions.previewEntry!)} />
      )}
      {fileActions.infoEntry && (
        <InfoPanel entry={fileActions.infoEntry} onClose={() => fileActions.setInfoEntry(null)} onRefresh={refresh} />
      )}
      {fileActions.batchRenameOpen && (
        <BatchRenameModal entries={selection.selectedEntries} onClose={() => fileActions.setBatchRenameOpen(false)} onDone={() => { shell.showToastObj({ title: 'Items renamed', variant: 'success' }); refresh(); }} />
      )}
      {dialogs.confirmDialog && <ConfirmDialog dialog={dialogs.confirmDialog} onClose={() => dialogs.setConfirmDialog(null)} />}
      {dialogs.textInputDialog && <TextInputDialog dialog={dialogs.textInputDialog} onClose={() => dialogs.setTextInputDialog(null)} />}
      {dialogs.transferDialog && (
        <TransferDialog dialog={dialogs.transferDialog} folderSuggestions={browser.folderSuggestions} onClose={() => dialogs.setTransferDialog(null)} onSubmit={fileCommands.handleTransferSubmit} />
      )}
      {dialogs.shareDialogPath && (
        <ShareDialog path={dialogs.shareDialogPath.path} name={dialogs.shareDialogPath.name} onClose={() => dialogs.setShareDialogPath(null)} />
      )}
      {fileActions.shortcutsOpen && <KeyboardShortcuts onClose={() => fileActions.setShortcutsOpen(false)} />}
      {dialogs.sharesOpen && <ShareManager onClose={() => dialogs.setSharesOpen(false)} />}
      {fileActions.analyzePath && (
        <DiskUsageAnalyzer path={fileActions.analyzePath} onClose={() => fileActions.setAnalyzePath(null)} />
      )}
    </>
  );
});
