import { Icon, FolderIcon, FileIcon } from './Icon';
import { BreadcrumbBar } from './BreadcrumbBar';
import { Select } from './Select';
import type { TrashEntry } from '../api/client';
import styles from './TrashView.module.css';

type ViewMode = 'list' | 'grid' | 'columns';
type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

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

function formatTrashPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

type TrashViewProps = {
  trashEntries: TrashEntry[];
  selectedTrashIds: string[];
  onSelectTrash: (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => void;
  onSelectAllTrash: () => void;
  onInvertSelectionTrash: () => void;
  onClearSelectionTrash: () => void;
  onBulkRestoreTrash: () => void;
  onBulkDeleteTrash: () => void;
  onCloseTrash: () => void;
  onRefreshTrash: () => void;
  viewMode: 'list' | 'grid' | 'columns';
  onCycleViewMode: () => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (value: string) => void;
  canWrite: boolean;
  sortedTrashEntries: TrashEntry[];
  onTrashContextMenu: (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => void;
};

export function TrashView({
  trashEntries, selectedTrashIds,
  onSelectTrash, onSelectAllTrash, onInvertSelectionTrash, onClearSelectionTrash,
  onBulkRestoreTrash, onBulkDeleteTrash,
  onCloseTrash, onRefreshTrash,
  viewMode, onCycleViewMode,
  sortField, sortDirection, onSortChange,
  canWrite,
  sortedTrashEntries,
  onTrashContextMenu,
}: TrashViewProps) {
  return (
    <>
      {selectedTrashIds.length > 0 ? (
        <header className={styles.topbar}>
          <div className={styles.selectionBar}>
            <span>{selectedTrashIds.length} selected</span>
            <div className={styles.selectionActions}>
              {canWrite && (
                <button type="button" className={styles.selectionActionBtn} onClick={onBulkRestoreTrash}>
                  <Icon name="edit-restore" size={16} />
                  Restore
                </button>
              )}
              {canWrite && (
                <button type="button" className={styles.dangerBtn} onClick={onBulkDeleteTrash}>
                  <Icon name="edit-delete" size={16} />
                  Delete
                </button>
              )}
            </div>
            <button type="button" className={styles.selectionActionBtn} onClick={onClearSelectionTrash}>
              Clear
            </button>
          </div>
        </header>
      ) : (
        <BreadcrumbBar
          crumbs={[{ label: 'Desktop' }, { label: 'Trash' }]}
          onBack={onCloseTrash}
          onNavigate={() => {}}
        >
          <button
            className="icon-button"
            disabled={trashEntries.length === 0}
            onClick={onSelectAllTrash}
            title="Select all"
            type="button"
          >
            <Icon name="selection-select-all" size={18} />
          </button>
          <button
            className="icon-button"
            disabled={trashEntries.length === 0}
            onClick={onInvertSelectionTrash}
            title="Invert selection"
            type="button"
          >
            <Icon name="selection-invert" size={18} />
          </button>
          <Select
            className={styles.sortSelect}
            value={`${sortField}:${sortDirection}`}
            onChange={onSortChange}
            ariaLabel="Sort trash"
          >
            <option value="name:asc">Name A-Z</option>
            <option value="name:desc">Name Z-A</option>
            <option value="size:asc">Size small first</option>
            <option value="size:desc">Size large first</option>
            <option value="type:asc">Type A-Z</option>
            <option value="type:desc">Type Z-A</option>
            <option value="modifiedAt:desc">Deleted newest first</option>
            <option value="modifiedAt:asc">Deleted oldest first</option>
          </Select>
          <button
            className="icon-button"
            onClick={onCycleViewMode}
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
          <button className="icon-button" onClick={onRefreshTrash} title="Refresh" type="button">
            <Icon name="view-refresh" size={18} />
          </button>
        </BreadcrumbBar>
      )}
      <section
        className={`${viewMode === 'grid' ? styles.fileGrid : styles.fileList}`}
        onContextMenu={(event) => event.preventDefault()}
        tabIndex={0}
      >
        {trashEntries.length === 0 ? (
          <div className={styles.emptyState}>Trash is empty</div>
        ) : (
          sortedTrashEntries.map((entry) => {
            const isSelected = selectedTrashIds.includes(entry.id);
            return viewMode === 'grid' ? (
              <div
                className={`${styles.fileRow}${isSelected ? ` ${styles.selected}` : ''}`}
                key={entry.id}
                onClick={(event) => onSelectTrash(entry, event)}
                onContextMenu={(event) => onTrashContextMenu(entry, event)}
                role="button"
              >
                {entry.type === 'directory' ? (
                  <FolderIcon size={84} />
                ) : (
                  <FileIcon entry={{
                    name: entry.name,
                    type: entry.type,
                    path: entry.originalPath,
                    size: entry.size,
                    modifiedAt: entry.deletedAt,
                    permissions: '',
                    owner: '',
                    group: '',
                    hidden: false,
                  }} size={84} />
                )}
                <span className={styles.fileName}>{entry.name}</span>
                <span className={styles.fileMeta}>
                  {formatBytes(entry.size)}
                  <span>{formatGridDate(entry.deletedAt)}</span>
                </span>
              </div>
            ) : (
              <div
                className={`${styles.fileRow}${isSelected ? ` ${styles.selected}` : ''}`}
                key={entry.id}
                onClick={(event) => onSelectTrash(entry, event)}
                onContextMenu={(event) => onTrashContextMenu(entry, event)}
                role="button"
              >
                {entry.type === 'directory' ? (
                  <FolderIcon size={28} />
                ) : (
                  <FileIcon entry={{
                    name: entry.name,
                    type: entry.type,
                    path: entry.originalPath,
                    size: entry.size,
                    modifiedAt: entry.deletedAt,
                    permissions: '',
                    owner: '',
                    group: '',
                    hidden: false,
                  }} size={28} />
                )}
                <span className={styles.fileName}>{entry.name}</span>
                <span>{entry.type}</span>
                <span>{formatBytes(entry.size)}</span>
                <span>{new Date(entry.deletedAt).toLocaleString()}</span>
                <span>{formatTrashPath(entry.originalPath)}</span>
                <span>{entry.id}</span>
                <span>{''}</span>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
