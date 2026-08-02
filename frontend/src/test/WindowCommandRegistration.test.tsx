import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../api/client-auth';
import {
  CommandsContext,
  WindowIdContext,
  type CommandsMap,
  type WindowCommands,
} from '../contexts/WindowCommands';
import { FilesView } from '../pages/FilesView';
import { TrashView } from '../pages/TrashView';

const api = vi.hoisted(() => ({
  deleteTrash: vi.fn(),
  getDevices: vi.fn(),
  getFiles: vi.fn(),
  getRoots: vi.fn(),
  getTrash: vi.fn(),
  restoreTrash: vi.fn(),
  searchFiles: vi.fn(),
}));

vi.mock('../api/client-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client-files')>()),
  deleteTrash: api.deleteTrash,
  getDevices: api.getDevices,
  getFiles: api.getFiles,
  getRoots: api.getRoots,
  getTrash: api.getTrash,
  restoreTrash: api.restoreTrash,
  searchFiles: api.searchFiles,
}));

type HarnessState = {
  commands: CommandsMap;
  registrations: number;
  updates: number;
};

// Keep the broken implementation bounded so it fails by assertion instead of timing out.
const maxUpdates = 12;

function commandsMatch(existing: WindowCommands | undefined, next: WindowCommands) {
  if (!existing) return false;
  return (
    existing.onCreateFolder === next.onCreateFolder &&
    existing.onUpload === next.onUpload &&
    existing.onCut === next.onCut &&
    existing.onCopy === next.onCopy &&
    existing.onPaste === next.onPaste &&
    existing.onSelectAll === next.onSelectAll &&
    existing.onInvertSelection === next.onInvertSelection &&
    existing.onRename === next.onRename &&
    existing.onDelete === next.onDelete &&
    existing.onRestore === next.onRestore &&
    existing.onDeleteForever === next.onDeleteForever &&
    existing.onEmptyTrash === next.onEmptyTrash &&
    existing.canWrite === next.canWrite &&
    existing.canUpload === next.canUpload &&
    existing.selectedCount === next.selectedCount
  );
}

function CommandRegistrationHarness({
  children,
  windowId,
}: {
  children: ReactNode;
  windowId: string;
}) {
  const [state, setState] = useState<HarnessState>({
    commands: {},
    registrations: 0,
    updates: 0,
  });

  const register = useCallback((id: string, commands: WindowCommands) => {
    setState((current) => {
      if (commandsMatch(current.commands[id], commands) || current.updates >= maxUpdates) {
        return current;
      }
      return {
        commands: { ...current.commands, [id]: commands },
        registrations: current.registrations + 1,
        updates: current.updates + 1,
      };
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setState((current) => {
      if (current.updates >= maxUpdates) return current;
      const commands = { ...current.commands };
      delete commands[id];
      return { ...current, commands, updates: current.updates + 1 };
    });
  }, []);

  const windowCommands = state.commands[windowId];

  return (
    <>
      <output aria-label="window command registrations">{state.registrations}</output>
      <output aria-label="window selected count">
        {windowCommands?.selectedCount ?? 'unregistered'}
      </output>
      <output aria-label="window can write">{String(windowCommands?.canWrite)}</output>
      <output aria-label="window can upload">{String(windowCommands?.canUpload)}</output>
      <button type="button" onClick={() => windowCommands?.onRestore?.()}>
        Run restore command
      </button>
      <CommandsContext.Provider value={{ commands: state.commands, register, unregister }}>
        <WindowIdContext.Provider value={windowId}>{children}</WindowIdContext.Provider>
      </CommandsContext.Provider>
    </>
  );
}

const readonlySession = {
  authEnabled: true,
  authenticated: true,
  role: 'readonly',
} satisfies Session;

const adminSession = {
  ...readonlySession,
  role: 'admin',
} satisfies Session;

const filesViewCallbacks = {
  onNavigate: vi.fn(),
  onBack: vi.fn(),
  onAddFavorite: vi.fn(),
  onRemoveFavorite: vi.fn(),
  onOpenStorageAnalyzer: vi.fn(),
};

function FilesWindow({ session }: { session: Session }) {
  return (
    <CommandRegistrationHarness windowId="files-1">
      <FilesView currentPath="/storage" session={session} favorites={[]} {...filesViewCallbacks} />
    </CommandRegistrationHarness>
  );
}

describe('window command registration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.deleteTrash.mockResolvedValue(undefined);
    api.getDevices.mockResolvedValue({ devices: [] });
    api.getFiles.mockResolvedValue({
      entries: [],
      total: 0,
      limit: 600,
      offset: 0,
      hasMore: false,
    });
    api.getRoots.mockResolvedValue({ roots: [] });
    api.getTrash.mockResolvedValue({ entries: [] });
    api.restoreTrash.mockResolvedValue(undefined);
    api.searchFiles.mockResolvedValue({ results: [] });
  });

  it('settles Files commands and propagates write access changes', async () => {
    const { rerender } = render(<FilesWindow session={readonlySession} />);

    expect(await screen.findByText('This folder is empty')).toBeInTheDocument();
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('1');
    expect(screen.getByLabelText('window can write')).toHaveTextContent('false');
    expect(screen.getByLabelText('window can upload')).toHaveTextContent('false');

    rerender(<FilesWindow session={adminSession} />);

    await waitFor(() =>
      expect(screen.getByLabelText('window can write')).toHaveTextContent('true'),
    );
    expect(screen.getByLabelText('window can upload')).toHaveTextContent('true');
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('2');
  });

  it('propagates Trash selection and invokes commands with the current selected item', async () => {
    const user = userEvent.setup();
    api.getTrash.mockResolvedValue({
      entries: [
        {
          id: 'trash-old',
          name: 'old.txt',
          originalPath: '/storage/old.txt',
          trashPath: '/storage/.trash/old.txt',
          type: 'file',
          size: 10,
          deletedAt: '2026-07-27T00:00:00Z',
          rootPath: '/storage',
        },
        {
          id: 'trash-current',
          name: 'current.txt',
          originalPath: '/storage/current.txt',
          trashPath: '/storage/.trash/current.txt',
          type: 'file',
          size: 20,
          deletedAt: '2026-07-28T00:00:00Z',
          rootPath: '/storage',
        },
      ],
    });

    render(
      <CommandRegistrationHarness windowId="trash-1">
        <TrashView />
      </CommandRegistrationHarness>,
    );

    const oldItem = await screen.findByText('old.txt');
    expect(screen.getByLabelText('window selected count')).toHaveTextContent('0');
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('1');

    await user.click(oldItem);
    await waitFor(() =>
      expect(screen.getByLabelText('window selected count')).toHaveTextContent('1'),
    );
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('2');

    await user.click(screen.getByText('current.txt'));
    expect(screen.getByLabelText('window selected count')).toHaveTextContent('1');
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'Run restore command' }));

    await waitFor(() => expect(api.restoreTrash).toHaveBeenCalledWith('trash-current'));
    expect(api.restoreTrash).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByLabelText('window selected count')).toHaveTextContent('0'),
    );
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('3');
  });

  it('shows a loading state before Trash data arrives', () => {
    api.getTrash.mockReturnValue(new Promise(() => {}));

    render(<TrashView />);

    expect(screen.getByRole('status', { name: 'Loading Trash' })).toBeInTheDocument();
    expect(screen.queryByText('Trash is empty')).not.toBeInTheDocument();
  });

  it('keeps failed bulk restores selected when other restores are queued', async () => {
    const user = userEvent.setup();
    api.getTrash.mockResolvedValue({
      entries: [
        {
          id: 'trash-a',
          name: 'a.txt',
          originalPath: '/storage/a.txt',
          trashPath: '/storage/.trash/a.txt',
          type: 'file',
          size: 10,
          deletedAt: '2026-07-28T00:00:00Z',
          rootPath: '/storage',
        },
        {
          id: 'trash-b',
          name: 'b.txt',
          originalPath: '/storage/b.txt',
          trashPath: '/storage/.trash/b.txt',
          type: 'file',
          size: 20,
          deletedAt: '2026-07-27T00:00:00Z',
          rootPath: '/storage',
        },
      ],
    });
    api.restoreTrash.mockImplementation((id: string) =>
      id === 'trash-b' ? Promise.reject(new Error('restore failed')) : Promise.resolve(undefined),
    );

    render(
      <CommandRegistrationHarness windowId="trash-1">
        <TrashView />
      </CommandRegistrationHarness>,
    );

    await user.click(await screen.findByText('a.txt'));
    await user.keyboard('{Control>}');
    await user.click(screen.getByText('b.txt'));
    await user.keyboard('{/Control}');
    expect(screen.getByLabelText('window selected count')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'Run restore command' }));

    await waitFor(() => expect(api.restoreTrash).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByLabelText('window selected count')).toHaveTextContent('1'),
    );
  });
});
