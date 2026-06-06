import { useState } from 'react';
import type { FileEntry } from '../api/client';
import type { ContextMenuState, RenameState } from '../types';

type ClipboardState = { mode: 'copy' | 'move'; entries: FileEntry[] } | null;

export function useFileActions() {
  const [renaming, setRenaming] = useState<RenameState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [infoEntry, setInfoEntry] = useState<FileEntry | null>(null);
  const [analyzePath, setAnalyzePath] = useState<string | null>(null);
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [fileClipboard, setFileClipboard] = useState<ClipboardState>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [locationMode, setLocationMode] = useState(false);

  return {
    renaming, setRenaming,
    contextMenu, setContextMenu,
    previewEntry, setPreviewEntry,
    infoEntry, setInfoEntry,
    analyzePath, setAnalyzePath,
    batchRenameOpen, setBatchRenameOpen,
    fileClipboard, setFileClipboard,
    shortcutsOpen, setShortcutsOpen,
    locationMode, setLocationMode,
  };
}
