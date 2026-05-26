import { useState } from 'react';
import type { FileEntry, SearchResult } from '../api/client';
import type { ContextMenuState, RenameState } from '../types';
import type { ConfirmDialogState, TextInputDialogState, TransferDialogState } from '../components/overlay/Dialogs';
import type { Toast } from '../components/overlay/Toast';

type ClipboardState = { mode: 'copy' | 'move'; entries: FileEntry[] } | null;

export function useFileActions() {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [renaming, setRenaming] = useState<RenameState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [infoEntry, setInfoEntry] = useState<FileEntry | null>(null);
  const [analyzePath, setAnalyzePath] = useState<string | null>(null);
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [fileClipboard, setFileClipboard] = useState<ClipboardState>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [textInputDialog, setTextInputDialog] = useState<TextInputDialogState>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [locationMode, setLocationMode] = useState(false);
  const [shareDialogPath, setShareDialogPath] = useState<{ path: string; name: string } | null>(null);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  return {
    query, setQuery,
    searchOpen, setSearchOpen,
    searchResults, setSearchResults,
    renaming, setRenaming,
    contextMenu, setContextMenu,
    previewEntry, setPreviewEntry,
    infoEntry, setInfoEntry,
    analyzePath, setAnalyzePath,
    batchRenameOpen, setBatchRenameOpen,
    fileClipboard, setFileClipboard,
    confirmDialog, setConfirmDialog,
    textInputDialog, setTextInputDialog,
    transferDialog, setTransferDialog,
    shortcutsOpen, setShortcutsOpen,
    locationMode, setLocationMode,
    shareDialogPath, setShareDialogPath,
    sharesOpen, setSharesOpen,
    toasts, setToasts,
  };
}
