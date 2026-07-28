import { render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommandsContext,
  WindowIdContext,
  type CommandsMap,
  type WindowCommands,
} from '../contexts/WindowCommands';
import { TrashView } from '../pages/TrashView';

const api = vi.hoisted(() => ({
  deleteTrash: vi.fn(),
  getTrash: vi.fn(),
  restoreTrash: vi.fn(),
}));

vi.mock('../api/client-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client-files')>()),
  deleteTrash: api.deleteTrash,
  getTrash: api.getTrash,
  restoreTrash: api.restoreTrash,
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

function CommandRegistrationHarness() {
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

  return (
    <>
      <output aria-label="window command registrations">{state.registrations}</output>
      <CommandsContext.Provider value={{ commands: state.commands, register, unregister }}>
        <WindowIdContext.Provider value="trash-1">
          <TrashView />
        </WindowIdContext.Provider>
      </CommandsContext.Provider>
    </>
  );
}

describe('window command registration', () => {
  beforeEach(() => {
    api.getTrash.mockResolvedValue({ entries: [] });
  });

  it('settles after registering commands for a real window', async () => {
    render(<CommandRegistrationHarness />);

    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
    expect(screen.getByLabelText('window command registrations')).toHaveTextContent('1');
  });
});
