import type { FileEntry } from '../api/client';

export type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
export type SortDirection = 'asc' | 'desc';
export type RenameState = { path: string; value: string } | null;
export type ContextMenuState = { x: number; y: number; entry: FileEntry } | null;
