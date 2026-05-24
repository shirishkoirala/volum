import { DragEvent, KeyboardEvent, MouseEvent, RefObject, TouchEvent } from 'react';
import { Icon, FileIcon, FolderIcon } from './Icon';
import { BreadcrumbBar } from './BreadcrumbBar';
import { Select } from './Select';
import { FilesSidebar } from './FilesSidebar';
import { EmptyState } from './EmptyState';
import { folderIconUrl } from '../api/icons';
import { rawUrl, downloadUrl, isImageExtension, isVideoExtension, isAudioExtension, isTextExtension } from '../api/client';
import type { FileEntry, SearchResult, BlockDevice } from '../api/client';
import styles from './FilesView.module.css';

type ViewMode = 'list' | 'grid' | 'columns';
type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';
type RenameState = { path: string; value: string } | null;
type ContextMenuState = { x: number; y: number; entry: FileEntry } | null;

function formatBytes(value: number) {
  if (value == null || Number.isNaN(value) || value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatGridDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function cycleViewMode(current: ViewMode): ViewMode {
  return current === 'list' ? 'grid' : current === 'grid' ? 'columns' : 'list';
}

type FilesViewProps = {
  currentPath: string;
  breadcrumbs: { label: string; path: string }[];
  onNavigate: (path: string) => void;
  onGoUp: () => void;
  onRefresh: () => void;
  entries: FileEntry[];
  filteredEntries: FileEntry[];
  selectedPaths: string[];
  onSelectEntry: (entry: FileEntry, event: MouseEvent<HTMLElement>) => void;
  onSelectAll: () => void;
  onInvertSelection: () => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (value: string) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  loading: boolean;
  error: string | null;
  sseConnected: boolean;
  onDismissError: () => void;
  canWrite: boolean;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  theme: string;
  onToggleTheme: () => void;
  session?: { authEnabled: boolean } | null;
  onLogout: () => void;
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onCreateFolder: () => void;
  onUpload: (files: FileList | File[]) => void;
  fileClick: (event: MouseEvent<HTMLElement>) => void;
  contextMenu: ContextMenuState;
  onContextMenu: (entry: FileEntry, event: MouseEvent<HTMLElement>) => void;
  onCloseContextMenu: () => void;
  draggingUpload: boolean;
  onFileAreaDragOver: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDragLeave: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDrop: (event: DragEvent<HTMLElement>) => void;
  onFileAreaMouseDown: (event: MouseEvent<HTMLElement>) => void;
  onFileAreaKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onFileDragStart: (event: DragEvent<HTMLElement>, entry: FileEntry) => void;
  onFolderDragOver: (event: DragEvent<HTMLElement>, path: string) => void;
  onFolderDragLeave: () => void;
  onDropOnFolder: (event: DragEvent<HTMLElement>, path: string) => void;
  dragOverPath: string | null;
  renameState: RenameState;
  renameInputRef?: RefObject<HTMLInputElement | null>;
  onSubmitRename: (entry: FileEntry) => void;
  onCancelRename: () => void;
  onRenameChange: (value: string) => void;
  rubberBandStyle: React.CSSProperties | null;
  onPreview: (entry: FileEntry) => void;
  fileGridRef?: RefObject<HTMLDivElement | null>;
  onEntryTouchStart?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchMove?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchEnd?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  // sidebar
  devices: BlockDevice[];
  favorites: string[];
  recentPaths: string[];
  subdirs: FileEntry[];
  sectionCollapsed: Record<string, boolean>;
  onToggleSection: (section: string) => void;
  onRemoveFavorite: (path: string) => void;
  locationMode?: boolean;
  onLocationNavigate?: (path: string) => void;
  onToggleLocationMode?: () => void;
};

export function FilesView({
  currentPath, breadcrumbs, onNavigate, onGoUp, onRefresh,
  entries, filteredEntries, selectedPaths,
  onSelectEntry, onSelectAll, onInvertSelection,
  viewMode, onSetViewMode, sortField, sortDirection, onSortChange,
  showHidden, onToggleHidden,
  loading, error, sseConnected, onDismissError,
  canWrite, isFavorited, onToggleFavorite,
  theme, onToggleTheme, session, onLogout,
  query, searchOpen, searchResults, onSearch, onClearSearch, onSearchResultClick,
  searchRef, fileInputRef, onCreateFolder, onUpload,
  fileClick, contextMenu, onContextMenu,
  draggingUpload,
  onFileAreaDragOver, onFileAreaDragLeave, onFileAreaDrop, onFileAreaMouseDown, onFileAreaKeyDown,
  onFileDragStart, onFolderDragOver, onFolderDragLeave, onDropOnFolder,
  dragOverPath, renameState, renameInputRef, onSubmitRename, onCancelRename, onRenameChange,
  rubberBandStyle, onPreview,
  fileGridRef, onEntryTouchStart, onEntryTouchMove, onEntryTouchEnd,
  devices, favorites, recentPaths, subdirs, sectionCollapsed, onToggleSection, onRemoveFavorite,
  locationMode, onLocationNavigate, onToggleLocationMode,
}: FilesViewProps) {

  function handleBreadcrumbBack() {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      onGoUp();
    } else {
      onNavigate('/' + parts.slice(0, -1).join('/'));
    }
  }

  function commitRename(entry: FileEntry) {
    onSubmitRename(entry);
  }

  function cancelRename() {
    onCancelRename();
  }

  function handleUploadClick() {
    if (fileInputRef?.current) {
      fileInputRef.current.click();
    }
  }

  function buildColumnPath(path: string): string[] {
    if (!path || path === '/') return ['/'];
    const parts = path.split('/').filter(Boolean);
    const cols: string[] = [];
    for (let i = 0; i <= parts.length; i++) {
      cols.push('/' + parts.slice(0, i).join('/'));
    }
    return cols;
  }

  return (
    <div className={styles.filesViewContainer}>
      <FilesSidebar
        devices={devices}
        favorites={favorites}
        recentPaths={recentPaths}
        currentPath={currentPath}
        subdirs={subdirs}
        sectionCollapsed={sectionCollapsed}
        onToggleSection={onToggleSection}
        onNavigate={onNavigate}
        onRemoveFavorite={onRemoveFavorite}
      />
      <div className={styles.fileContent}>
        <BreadcrumbBar crumbs={breadcrumbs} onBack={handleBreadcrumbBack} onNavigate={onNavigate} locationMode={locationMode} onLocationNavigate={onLocationNavigate} onToggleLocationMode={onToggleLocationMode}>
          <div className={styles.toolbar}>
            {canWrite && (
              <button
                className="icon-button"
                onClick={onCreateFolder}
                title="Create folder"
                type="button"
              >
                <Icon name="folder-new" size={18} />
              </button>
            )}
            {canWrite && (
              <button
                className="icon-button"
                onClick={handleUploadClick}
                title="Upload files"
                type="button"
              >
                <Icon name="document-import" size={18} />
              </button>
            )}
            <input
              ref={fileInputRef as React.RefObject<HTMLInputElement>}
              className={styles.hiddenFileInput}
              multiple
              type="file"
              onChange={(event) => {
                if (event.currentTarget.files) {
                  onUpload(event.currentTarget.files);
                  event.currentTarget.value = '';
                }
              }}
            />
            <button
              className="icon-button"
              disabled={filteredEntries.length === 0}
              onClick={onSelectAll}
              title="Select all"
              type="button"
            >
              <Icon name="selection-select-all" size={18} />
            </button>
            <button
              className="icon-button"
              disabled={filteredEntries.length === 0}
              onClick={onInvertSelection}
              title="Invert selection"
              type="button"
            >
              <Icon name="selection-invert" size={18} />
            </button>
            <label className={styles.searchBox}>
              <Icon name="edit-find" size={16} />
              <input
                ref={searchRef as React.RefObject<HTMLInputElement>}
                placeholder="Search files (Ctrl+K)"
                value={query}
                onFocus={() => {}}
                onChange={(event) => onSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    onClearSearch();
                  }
                }}
              />
              {query.length > 0 && (
                <button type="button" className={styles.searchClear} onClick={onClearSearch}>
                  <Icon name="window-close" size={14} />
                </button>
              )}
            </label>
            {searchOpen && searchResults && searchResults.length > 0 && (
              <div className={styles.searchResultsDropdown}>
                {searchResults.map((result) => (
                  <button
                    key={result.path}
                    type="button"
                    className={styles.searchResultItem}
                    onClick={() => onSearchResultClick(result)}
                  >
                    <FileIcon entry={{ ...result, hidden: false, permissions: '', owner: '', group: '' }} size={20} />
                    <span className={styles.searchResultName}>{result.name}</span>
                    <span className={styles.searchResultPath}>{result.root}</span>
                  </button>
                ))}
              </div>
            )}
            <Select
              className={styles.sortSelect}
              value={`${sortField}:${sortDirection}`}
              onChange={onSortChange}
              ariaLabel="Sort files"
            >
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="size:asc">Size small first</option>
              <option value="size:desc">Size large first</option>
              <option value="type:asc">Type A-Z</option>
              <option value="type:desc">Type Z-A</option>
              <option value="modifiedAt:desc">Newest first</option>
              <option value="modifiedAt:asc">Oldest first</option>
            </Select>
            <button
              className="icon-button"
              onClick={onToggleHidden}
              title="Toggle hidden files"
              type="button"
            >
              <Icon name="view-hidden" size={18} />
            </button>
            <button
              className="icon-button"
              onClick={onRefresh}
              title="Refresh"
              type="button"
            >
              <Icon name="view-refresh" size={18} />
            </button>
            <button
              className={`icon-button${isFavorited ? ' active' : ''}`}
              onClick={onToggleFavorite}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              type="button"
            >
              <Icon name="bookmark-new" size={18} />
            </button>
            <button
              className="icon-button"
              onClick={() => onSetViewMode(cycleViewMode(viewMode))}
              title="Change view"
              type="button"
            >
              {viewMode === 'list' ? (
                <Icon name="view-grid" size={18} />
              ) : viewMode === 'grid' ? (
                <Icon name="view-list-column" size={18} />
              ) : (
                <Icon name="view-list-tree" size={18} />
              )}
            </button>
            <button
              className="icon-button"
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
              type="button"
            >
              {theme === 'light' ? (
                <Icon name="weather-clear-night" size={18} />
              ) : (
                <Icon name="weather-clear" size={18} />
              )}
            </button>
            {session?.authEnabled && (
              <button
                className="icon-button"
                onClick={onLogout}
                title="Log out"
                type="button"
              >
                <Icon name="system-log-out" size={18} />
              </button>
            )}
          </div>
        </BreadcrumbBar>

        {error && (
          <div className={styles.errorBanner}>
            {error}
            <button type="button" className={styles.errorDismiss} onClick={onDismissError} aria-label="Dismiss error">&times;</button>
          </div>
        )}
        {!sseConnected && (
          <div className={styles.sseWarning}>Connection lost &mdash; reconnecting...</div>
        )}

        {loading ? (
          <div className={viewMode === 'columns' ? styles.columnSkeleton : styles.skeletonGrid}>
            {Array.from({ length: viewMode === 'columns' ? 4 : 12 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonIcon} />
                <div className={styles.skeletonLine} />
                <div className={`${styles.skeletonLine} ${styles.short}`} />
              </div>
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <EmptyState icon={folderIconUrl('64')} title="This folder is empty" subtitle={currentPath} />
        ) : (
          <section
            className={`${viewMode === 'grid' ? styles.fileGrid : viewMode === 'columns' ? styles.fileColumns : styles.fileList}${draggingUpload ? ` ${styles.dragOver}` : ''}`}
            ref={fileGridRef as RefObject<HTMLDivElement>}
            onDragLeave={onFileAreaDragLeave}
            onDragOver={onFileAreaDragOver}
            onDrop={onFileAreaDrop}
            onClick={fileClick}
            onMouseDown={onFileAreaMouseDown}
            onKeyDown={onFileAreaKeyDown}
            tabIndex={0}
          >
            {viewMode === 'columns' ? (
              <div className={styles.columnBrowser}>
                {buildColumnPath(currentPath).map((col, colIdx) => (
                  <div key={col} className={styles.columnPane}>
                    {col === currentPath ? (
                      filteredEntries.map((entry) => (
                        <div
                          className={`${styles.columnItem}${selectedPaths.includes(entry.path) ? ` ${styles.selected}` : ''}`}
                          key={entry.path}
                          onClick={(event) => onSelectEntry(entry, event)}
                          onContextMenu={(event) => onContextMenu(entry, event)}
                          onDoubleClick={() => {
                            if (renameState) return;
                            if (entry.type === 'directory') {
                              onNavigate(entry.path);
                            } else {
                              const ext = entry.name.toLowerCase();
                              if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext) || ext.endsWith('.pdf')) {
                                onPreview(entry);
                              } else {
                                window.open(downloadUrl(entry.path), '_blank');
                              }
                            }
                          }}
                        >
                          {entry.type === 'directory' ? <FolderIcon size={18} /> : <FileIcon entry={entry} size={18} />}
                          <span className={styles.columnItemName}>{entry.name}</span>
                        </div>
                      ))
                    ) : (
                      <div
                        className={styles.columnItem}
                        onClick={() => onNavigate(col)}
                      >
                        <FolderIcon size={18} />
                        <span className={styles.columnItemName}>{col === '/' ? '/' : col.split('/').pop() || col}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const fileIconSize = viewMode === 'grid' ? 84 : 28;
                return (
                  <div
                    className={`${selectedPaths.includes(entry.path) ? `${styles.fileRow} ${styles.selected}` : styles.fileRow}${dragOverPath === entry.path ? ` ${styles.dragOver}` : ''}`}
                    key={entry.path}
                    draggable={canWrite}
                    onDragStart={(event) => onFileDragStart(event, entry)}
                    onDragOver={(event) => entry.type === 'directory' ? onFolderDragOver(event, entry.path) : undefined}
                    onDragLeave={entry.type === 'directory' ? onFolderDragLeave : undefined}
                    onDrop={(event) => entry.type === 'directory' ? onDropOnFolder(event, entry.path) : undefined}
                    onClick={(event) => onSelectEntry(entry, event)}
                    onContextMenu={(event) => onContextMenu(entry, event)}
                    onTouchStart={onEntryTouchStart ? (event) => onEntryTouchStart(entry, event) : undefined}
                    onTouchMove={onEntryTouchMove ? (event) => onEntryTouchMove(entry, event) : undefined}
                    onTouchEnd={onEntryTouchEnd ? (event) => onEntryTouchEnd(entry, event) : undefined}
                    onDoubleClick={() => {
                      if (renameState) return;
                      if (entry.type === 'directory') {
                        onNavigate(entry.path);
                        return;
                      }
                      const ext = entry.name.toLowerCase();
                      if (isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext) || ext.endsWith('.pdf')) {
                        onPreview(entry);
                      } else {
                        window.open(downloadUrl(entry.path), '_blank');
                      }
                    }}
                    role="button"
                  >
                    {entry.type === 'directory' ? (
                      <FolderIcon size={fileIconSize} />
                    ) : isImageExtension(entry.name.toLowerCase()) ? (
                      <img
                        className={styles.fileThumb}
                        src={rawUrl(entry.path)}
                        alt={entry.name}
                        loading="lazy"
                      />
                    ) : (
                      <FileIcon entry={entry} size={fileIconSize} />
                    )}
                    {renameState?.path === entry.path ? (
                      <input
                        ref={renameInputRef as React.RefObject<HTMLInputElement>}
                        className="rename-input"
                        value={renameState.value}
                        onBlur={() => commitRename(entry)}
                        onChange={(event) => onRenameChange(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onContextMenu={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitRename(entry);
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                    ) : (
                      <span className={styles.fileName}>{entry.name}</span>
                    )}
                    {viewMode === 'grid' && (
                      <span className={styles.fileMeta}>
                        {formatBytes(entry.size)}
                        <span>{formatGridDate(entry.modifiedAt)}</span>
                      </span>
                    )}
                    {viewMode === 'list' && (
                      <>
                        <span>{entry.type}</span>
                        <span>{formatBytes(entry.size)}</span>
                        <span>{new Date(entry.modifiedAt).toLocaleString()}</span>
                        <span>{entry.permissions}</span>
                        <span>{entry.owner}</span>
                        <span>{entry.group}</span>
                      </>
                    )}
                  </div>
                );
              })
            )}
            {rubberBandStyle && <div className={styles.rubberBand} style={rubberBandStyle} />}
          </section>
        )}
      </div>
    </div>
  );
}
