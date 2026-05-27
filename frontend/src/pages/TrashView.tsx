import { FolderIcon, FileIcon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { trashIconUrl } from '../api/icons';
import type { TrashEntry } from '../api/client';
import { formatBytes, formatGridDate } from '../utils/format';
import { GRID_ICON_SIZE, GridTile } from '../components/ui/GridTile';
import styles from './TrashView.module.css';

type TrashViewProps = {
  trashEntries: TrashEntry[];
  selectedTrashIds: string[];
  onSelectTrash: (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => void;
  sortedTrashEntries: TrashEntry[];
  onTrashContextMenu: (entry: TrashEntry, event: React.MouseEvent<HTMLElement>) => void;
};

export function TrashView({
  trashEntries, selectedTrashIds,
  onSelectTrash,
  sortedTrashEntries,
  onTrashContextMenu,
}: TrashViewProps) {
  return (
    <>
      {trashEntries.length === 0 ? (
        <div className={styles.emptyWrapper}>
          <EmptyState icon={trashIconUrl(false, '64')} title="Trash is empty" />
        </div>
      ) : (
        <section
          className={styles.trashGrid}
          onContextMenu={(event) => event.preventDefault()}
          tabIndex={-1}
          role="list"
        >
          {sortedTrashEntries.map((entry, idx) => {
            const isSelected = selectedTrashIds.includes(entry.id);

            function handleTrashKeyDown(e: React.KeyboardEvent) {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSelectTrash(entry, e as unknown as React.MouseEvent<HTMLElement>);
                return;
              }
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = document.querySelectorAll<HTMLElement>(`[data-trash-id]`);
                const currentIdx = Array.from(items).indexOf(e.currentTarget as HTMLElement);
                const next = e.key === 'ArrowDown'
                  ? Math.min(currentIdx + 1, items.length - 1)
                  : Math.max(currentIdx - 1, 0);
                items[next]?.focus();
              }
            }

            return (
              <GridTile
                key={entry.id}
                className={styles.trashItem}
                icon={entry.type === 'directory' ? <FolderIcon size={GRID_ICON_SIZE} /> : <FileIcon entry={{
                  name: entry.name,
                  type: entry.type,
                  path: entry.originalPath,
                  size: entry.size,
                  modifiedAt: entry.deletedAt,
                  permissions: '',
                  owner: '',
                  group: '',
                  hidden: false,
                }} size={GRID_ICON_SIZE} />}
                name={entry.name}
                metadata={<>
                  <span>{formatBytes(entry.size)}</span>
                  <span>{formatGridDate(entry.deletedAt)}</span>
                </>}
                isSelected={isSelected}
                isDragOver={false}
                role="listitem"
                tabIndex={idx === 0 ? 0 : -1}
                data-trash-id={entry.id}
                onClick={(event) => onSelectTrash(entry, event)}
                onContextMenu={(event) => onTrashContextMenu(entry, event)}
                onKeyDown={handleTrashKeyDown}
              />
            );
          })
          }
        </section>
      )}
    </>
  );
}
