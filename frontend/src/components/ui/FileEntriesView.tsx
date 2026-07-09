import { DragEvent, KeyboardEvent, RefObject, TouchEvent } from 'react';
import { FileGridView } from './FileGridView';
import { FileListView } from './FileListView';
import type { FileEntry } from '../../api/client';
import type { RenameState } from '../../types';
import type { ViewMode } from '../../utils/view';

type FileEntriesViewProps = {
  viewMode: ViewMode;
  filteredEntries: FileEntry[];
  selectedPaths: string[];
  onContextMenu: (entry: FileEntry, event: React.MouseEvent<HTMLElement>) => void;
  onEmptyContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  canWrite: boolean;
  onFileDragStart: (event: DragEvent<HTMLElement>, entry: FileEntry) => void;
  onFolderDragOver: (event: DragEvent<HTMLElement>, path: string) => void;
  onFolderDragLeave: () => void;
  onDropOnFolder: (event: DragEvent<HTMLElement>, path: string) => void;
  dragOverPath: string | null;
  favorites: string[];
  renameState: RenameState | null;
  renameInputRef?: RefObject<HTMLInputElement | null>;
  onSubmitRename: (entry: FileEntry) => void;
  onCancelRename: () => void;
  onRenameChange: (value: string) => void;
  fileGridRef?: RefObject<HTMLDivElement | null>;
  rubberBandStyle: React.CSSProperties | null;
  fileClick: (event: React.MouseEvent<HTMLElement>) => void;
  onFileAreaDragOver: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDragLeave: (event: DragEvent<HTMLElement>) => void;
  onFileAreaDrop: (event: DragEvent<HTMLElement>) => void;
  onFileAreaMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  onFileAreaKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  draggingUpload: boolean;
  totalEntries?: number;
  loadingMore?: boolean;
  onLoadMoreEntries?: () => void;
  onVisibleCountChange?: (renderedCount: number, totalCount: number) => void;
  resetKey?: string;
  onEntryTouchStart?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchMove?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onEntryTouchEnd?: (entry: FileEntry, event: TouchEvent<HTMLElement>) => void;
  onNavigate: (path: string) => void;
  onPreview: (entry: FileEntry) => void;
};

export function FileEntriesView({ viewMode, ...rest }: FileEntriesViewProps) {
  if (viewMode === 'grid') {
    return <FileGridView {...rest} />;
  }

  return <FileListView {...rest} />;
}
