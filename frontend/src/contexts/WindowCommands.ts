import { createContext, useContext } from 'react';

export type WindowCommands = {
  onCreateFolder?: () => void;
  onUpload?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onInvertSelection?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDeleteForever?: () => void;
  onEmptyTrash?: () => void;
  canWrite?: boolean;
  canUpload?: boolean;
  selectedCount?: number;
};

export type CommandsMap = Record<string, WindowCommands>;

export const CommandsContext = createContext<{
  commands: CommandsMap;
  register: (id: string, cmds: WindowCommands) => void;
  unregister: (id: string) => void;
}>({
  commands: {},
  register: () => {},
  unregister: () => {},
});

export function useCommandsContext() {
  return useContext(CommandsContext);
}

// ── WindowId context ──────────────────────────────────────

export const WindowIdContext = createContext<string>('');

export function useWindowId(): string {
  return useContext(WindowIdContext);
}
