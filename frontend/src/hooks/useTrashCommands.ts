import { deleteTrash, deletePath, getTrash, restoreTrash } from '../api/client';
import type { TrashEntry } from '../api/client';

type TrashCommandDeps = {
  runAction: (action: () => Promise<unknown>, successTitle?: string) => void;
  setTrashEntries: React.Dispatch<React.SetStateAction<TrashEntry[]>>;
  setTrashContextMenu: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; entry: TrashEntry } | null>
  >;
  setConfirmDialog: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>
  >;
  showToastObj: (
    toast: {
      title: string;
      message?: string;
      variant: 'success' | 'error' | 'warning';
      action?: { label: string; onClick: () => void };
    },
    timeout?: number,
  ) => void;
};

export function useTrashCommands(deps: TrashCommandDeps) {
  const { runAction, setTrashEntries, setTrashContextMenu, setConfirmDialog, showToastObj } = deps;

  const handleRestoreTrash = (entry: TrashEntry) => {
    void runAction(async () => {
      await restoreTrash(entry.id);
      const r = await getTrash();
      setTrashEntries(r.entries ?? []);
    });
    showToastObj(
      {
        title: 'Item restored',
        message: entry.originalPath,
        variant: 'success',
        action: {
          label: 'Undo',
          onClick: () => {
            void deletePath(entry.originalPath, entry.name);
            getTrash().then((r) => setTrashEntries(r.entries ?? []));
            showToastObj({ title: 'Restore undone', variant: 'success' });
          },
        },
      },
      8000,
    );
  };

  const handleDeleteTrash = (entry: TrashEntry) => {
    setTrashContextMenu(null);
    setConfirmDialog({
      title: 'Delete Permanently',
      message: `Permanently delete "${entry.name}"? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      danger: true,
      onConfirm: () => {
        void runAction(async () => {
          await deleteTrash(entry.id);
          const r = await getTrash();
          setTrashEntries(r.entries ?? []);
        }, 'Item deleted permanently');
      },
    });
  };

  return { handleRestoreTrash, handleDeleteTrash };
}
