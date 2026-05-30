import { DragEvent, KeyboardEvent, MouseEvent, RefObject, TouchEvent } from 'react';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import { EmptyState } from '../components/ui/EmptyState';
import { FileSearchBar } from '../components/ui/FileSearchBar';
import { FileColumnView } from '../components/ui/FileColumnView';
import { FileGridView } from '../components/ui/FileGridView';
import { FileListView } from '../components/ui/FileListView';
import { folderIconUrl } from '../api/icons';
import type { FileEntry, SearchResult } from '../api/client';
import type { ViewMode } from '../utils/view';
import type { RenameState } from '../types';
import styles from './FilesView.module.css';

type NavigationProps = {
  currentPath: string;
  breadcrumbs: { label: string; path: string }[];
  onNavigate: (path: string) => void;
  onGoUp: () => void;
  locationMode?: boolean;
  onLocationNavigate?: (path: string) => void;
  onToggleLocationMode?: () => void;
};

type SearchProps = {
  query: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onUpload: (files: FileList | File[]) => void;
  onRefresh: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
};

type SelectionProps = {
  selectedPaths: string[];
  filteredEntries: FileEntry[];
  fileClick: (event: MouseEvent<HTMLElement>) => void;
};

type DragDropProps = {
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
};

type RenameProps = {
  renameState: RenameState;
  renameInputRef?: RefObject<HTMLInputElement | null>;
  onSubmitRename: (entry: FileEntry) => void;
  onCancelRename: () => void;
  onRenameChange: (value: string) => void;
};

type ContextProps = {
  onFilesEmptyContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onContextMenu: (entry: FileEntry, event: MouseEvent<HTMLElement>) => void;
};

type LoadErrorProps = {
  loading: boolean;
  error: string | null;
  onDismissError: () => void;
};

type TouchProps = {
  onEntryTouchStart?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchMove?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchEnd?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
};

type FilesViewProps = {
  navigation: NavigationProps;
  search: SearchProps;
  selection: SelectionProps;
  dragDrop: DragDropProps;
  rename: RenameProps;
  context: ContextProps;
  loadError: LoadErrorProps;
  touch?: TouchProps;
  viewMode: ViewMode;
  canWrite: boolean;
  favorites: string[];
  onPreview: (entry: FileEntry) => void;
  fileGridRef?: RefObject<HTMLDivElement | null>;
  rubberBandStyle: React.CSSProperties | null;
};

export function FilesView({
  navigation, search, selection, dragDrop, rename, context, loadError,
  touch, viewMode, canWrite, favorites, onPreview, fileGridRef, rubberBandStyle,
}: FilesViewProps) {
  const {
    currentPath, breadcrumbs, onNavigate, onGoUp,
    locationMode, onLocationNavigate, onToggleLocationMode,
  } = navigation;
  const {
    query, searchOpen, searchResults, onSearch, onClearSearch, onSearchResultClick,
    searchRef, fileInputRef, onUpload, onRefresh, isFavorited, onToggleFavorite,
  } = search;
  const { selectedPaths, filteredEntries, fileClick } = selection;
  const {
    draggingUpload, onFileAreaDragOver, onFileAreaDragLeave, onFileAreaDrop,
    onFileAreaMouseDown, onFileAreaKeyDown, onFileDragStart, onFolderDragOver,
    onFolderDragLeave, onDropOnFolder, dragOverPath,
  } = dragDrop;
  const {
    renameState, renameInputRef, onSubmitRename, onCancelRename, onRenameChange,
  } = rename;
  const { onFilesEmptyContextMenu, onContextMenu } = context;
  const { loading, error, onDismissError } = loadError;
  const {
    onEntryTouchStart, onEntryTouchMove, onEntryTouchEnd,
  } = touch ?? {};

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

  function renderEntries() {
    if (viewMode === 'columns') {
      return (
        <FileColumnView
          currentPath={currentPath}
          filteredEntries={filteredEntries}
          selectedPaths={selectedPaths}
          onContextMenu={onContextMenu}
          onEmptyContextMenu={onFilesEmptyContextMenu}
          onNavigate={onNavigate}
          onPreview={onPreview}
          renameState={renameState}
          draggingUpload={draggingUpload}
          fileGridRef={fileGridRef}
          rubberBandStyle={rubberBandStyle}
          fileClick={fileClick}
          onFileAreaDragOver={onFileAreaDragOver}
          onFileAreaDragLeave={onFileAreaDragLeave}
          onFileAreaDrop={onFileAreaDrop}
          onFileAreaMouseDown={onFileAreaMouseDown}
          onFileAreaKeyDown={onFileAreaKeyDown}
        />
      );
    }
    if (viewMode === 'grid') {
      return (
        <FileGridView
          filteredEntries={filteredEntries}
          selectedPaths={selectedPaths}
          onContextMenu={onContextMenu}
          onEmptyContextMenu={onFilesEmptyContextMenu}
          canWrite={canWrite}
          onFileDragStart={onFileDragStart}
          onFolderDragOver={onFolderDragOver}
          onFolderDragLeave={onFolderDragLeave}
          onDropOnFolder={onDropOnFolder}
          dragOverPath={dragOverPath}
          favorites={favorites}
          renameState={renameState}
          renameInputRef={renameInputRef}
          onSubmitRename={commitRename}
          onCancelRename={onCancelRename}
          onRenameChange={onRenameChange}
          fileGridRef={fileGridRef}
          rubberBandStyle={rubberBandStyle}
          fileClick={fileClick}
          onFileAreaDragOver={onFileAreaDragOver}
          onFileAreaDragLeave={onFileAreaDragLeave}
          onFileAreaDrop={onFileAreaDrop}
          onFileAreaMouseDown={onFileAreaMouseDown}
          onFileAreaKeyDown={onFileAreaKeyDown}
          draggingUpload={draggingUpload}
          onEntryTouchStart={onEntryTouchStart}
          onEntryTouchMove={onEntryTouchMove}
          onEntryTouchEnd={onEntryTouchEnd}
          onNavigate={onNavigate}
          onPreview={onPreview}
        />
      );
    }
    return (
      <FileListView
        filteredEntries={filteredEntries}
        selectedPaths={selectedPaths}
        onContextMenu={onContextMenu}
        onEmptyContextMenu={onFilesEmptyContextMenu}
        canWrite={canWrite}
        onFileDragStart={onFileDragStart}
        onFolderDragOver={onFolderDragOver}
        onFolderDragLeave={onFolderDragLeave}
        onDropOnFolder={onDropOnFolder}
        dragOverPath={dragOverPath}
        favorites={favorites}
        renameState={renameState}
        renameInputRef={renameInputRef}
        onSubmitRename={commitRename}
        onCancelRename={onCancelRename}
        onRenameChange={onRenameChange}
        fileGridRef={fileGridRef}
        rubberBandStyle={rubberBandStyle}
        fileClick={fileClick}
        onFileAreaDragOver={onFileAreaDragOver}
        onFileAreaDragLeave={onFileAreaDragLeave}
        onFileAreaDrop={onFileAreaDrop}
        onFileAreaMouseDown={onFileAreaMouseDown}
        onFileAreaKeyDown={onFileAreaKeyDown}
        draggingUpload={draggingUpload}
        onEntryTouchStart={onEntryTouchStart}
        onEntryTouchMove={onEntryTouchMove}
        onEntryTouchEnd={onEntryTouchEnd}
        onNavigate={onNavigate}
        onPreview={onPreview}
      />
    );
  }

  return (
    <div className={styles.filesViewContainer}>
      <div className={styles.fileContent} onContextMenu={onFilesEmptyContextMenu}>
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
          renderEntries()
        )}
      </div>
    </div>
  );
}
