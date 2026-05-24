import { Icon, FolderIcon, FileIcon } from './Icon';
import { BreadcrumbBar } from './BreadcrumbBar';
import { EmptyState } from './EmptyState';
import { SortSelect } from './SortSelect';
import { trashIconUrl } from '../api/icons';
import type { TrashEntry } from '../api/client';
import { formatBytes, formatGridDate, formatTrashPath } from '../utils/format';
import { type ViewMode } from '../utils/view';
import styles from './TrashView.module.css';

type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

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
          <SortSelect view="trash" sortField={sortField} sortDirection={sortDirection} onChange={onSortChange} className={styles.sortSelect} />
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
      {trashEntries.length === 0 ? (
        <div className={styles.emptyWrapper}>
          <EmptyState icon={trashIconUrl(false, '64')} title="Trash is empty" />
        </div>
      ) : (
        <section
          className={`${viewMode === 'grid' ? styles.fileGrid : styles.fileList}`}
          onContextMenu={(event) => event.preventDefault()}
          tabIndex={0}
        >
          {sortedTrashEntries.map((entry) => {
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
          }
        </section>
      )}
    </>
  );
}
