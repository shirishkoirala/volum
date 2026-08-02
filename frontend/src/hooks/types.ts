import type { FileEntry } from '../api/client-files';

export type ClipboardState = { mode: 'copy' | 'move'; entries: FileEntry[] } | null;

export type RunAction = (action: () => Promise<unknown>, successTitle?: string) => Promise<void>;
