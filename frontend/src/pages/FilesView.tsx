import { DragEvent, KeyboardEvent, MouseEvent, RefObject, TouchEvent } from 'react';
import { Icon, FileIcon, FolderIcon } from '../components/ui/Icon';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { EmptyState } from '../components/ui/EmptyState';
import { FileSearchBar } from '../components/ui/FileSearchBar';
import { folderIconUrl } from '../api/icons';
import { rawUrl, isImageExtension } from '../api/client';
import type { FileEntry, SearchResult } from '../api/client';
import { formatBytes, formatGridDate } from '../utils/format';
import { buildColumnPath } from '../utils/path';
import type { ViewMode } from '../utils/view';
import { isPreviewableFile, openFileExternally } from '../utils/preview';
import type { RenameState, ContextMenuState } from '../types';
import styles from './FilesView.module.css';

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
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  onDismissError: () => void;
  canWrite: boolean;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
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
  favorites: string[];
  locationMode?: boolean;
  onLocationNavigate?: (path: string) => void;
  onToggleLocationMode?: () => void;
};

export function FilesView({
  currentPath, breadcrumbs, onNavigate, onGoUp, onRefresh,
  filteredEntries, selectedPaths,
  onSelectEntry,
  viewMode,
  loading, error, onDismissError,
  canWrite, isFavorited, onToggleFavorite,
  query, searchOpen, searchResults, onSearch, onClearSearch, onSearchResultClick,
  searchRef, fileInputRef, onUpload,
  fileClick, onContextMenu,
  draggingUpload,
  onFileAreaDragOver, onFileAreaDragLeave, onFileAreaDrop, onFileAreaMouseDown, onFileAreaKeyDown,
  onFileDragStart, onFolderDragOver, onFolderDragLeave, onDropOnFolder,
  dragOverPath, renameState, renameInputRef, onSubmitRename, onCancelRename, onRenameChange,
  rubberBandStyle, onPreview,
  fileGridRef, onEntryTouchStart, onEntryTouchMove, onEntryTouchEnd,
  favorites,
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

  return (
    <div className={styles.filesViewContainer}>
      <div className={styles.fileContent}>
        <BreadcrumbBar crumbs={breadcrumbs} onBack={handleBreadcrumbBack} onNavigate={onNavigate} locationMode={locationMode} onLocationNavigate={onLocationNavigate} onToggleLocationMode={onToggleLocationMode}>
          <FileSearchBar
            query={query} searchOpen={searchOpen} searchResults={searchResults}
            onSearch={onSearch} onClearSearch={onClearSearch} onSearchResultClick={onSearchResultClick}
            onRefresh={onRefresh} isFavorited={isFavorited} onToggleFavorite={onToggleFavorite}
            searchRef={searchRef} fileInputRef={fileInputRef} onUpload={onUpload}
          />
        </BreadcrumbBar>

        {error && (
          <div className={styles.errorBanner}>
            {error}
            <button type="button" className={styles.errorDismiss} onClick={onDismissError} aria-label="Dismiss error">&times;</button>
          </div>
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
                {buildColumnPath(currentPath).map((col) => (
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
                              if (isPreviewableFile(entry.name)) {
                                onPreview(entry);
                              } else {
                                openFileExternally(entry.path);
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
                      if (isPreviewableFile(entry.name)) {
                        onPreview(entry);
                      } else {
                        openFileExternally(entry.path);
                      }
                    }}
                    role="button"
                  >
                    {entry.type === 'directory' ? (
                      <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <FolderIcon size={fileIconSize} />
                        {favorites.includes(entry.path) && (
                          <span className={styles.pinBadge}>
                            <Icon name="bookmark-new" size={10} />
                          </span>
                        )}
                      </span>
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
                        className={styles.renameInput}
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
