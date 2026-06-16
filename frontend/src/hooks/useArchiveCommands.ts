import type { Dispatch, SetStateAction } from 'react';
import type { FileEntry } from '../api/client';
import { createJob } from '../api/client';
import { archiveBaseName, archiveFileName, isArchiveFile } from '../utils/archive';
import { joinPath, normalizeFolderPath } from '../utils/path';
import type { TextInputDialogState } from '../components/overlay/Dialogs';
import type { ContextMenuState } from '../types';
import type { RunAction } from './types';

interface ArchiveCommandDeps {
  currentPath: string;
  folderSuggestions: string[];
  selectedEntries: FileEntry[];
  setContextMenu: Dispatch<SetStateAction<ContextMenuState>>;
  setTextInputDialog: Dispatch<SetStateAction<TextInputDialogState>>;
  setAnalyzePath: Dispatch<SetStateAction<string | null>>;
  runAction: RunAction;
}

export function useArchiveCommands({
  currentPath,
  folderSuggestions,
  selectedEntries,
  setContextMenu,
  setTextInputDialog,
  setAnalyzePath,
  runAction,
}: ArchiveCommandDeps) {
  const handleCreateArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) return;
    const archiveName = archiveFileName(entry.name);
    const defaultPath = joinPath(currentPath, archiveName);
    setContextMenu(null);
    setTextInputDialog({
      title: 'Create Archive',
      label: 'Archive path',
      initialValue: defaultPath,
      placeholder: defaultPath,
      confirmLabel: 'Create Archive',
      folderSuggestions,
      suggestionLabel: 'Create in',
      applyFolderSuggestion: (path) => joinPath(path, archiveName),
      onSubmit: (value) => {
        void runAction(() => createJob({
          type: 'archive',
          sourcePath: entry.path,
          destinationPath: value.trim(),
          conflictPolicy: 'rename',
        }), 'Archive transfer started');
      },
    });
  };

  const handleExtractArchive = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1 || entry.type !== 'file' || !isArchiveFile(entry.name)) return;
    const defaultPath = joinPath(currentPath, archiveBaseName(entry.name));
    setContextMenu(null);
    setTextInputDialog({
      title: 'Extract Archive',
      label: 'Destination folder path',
      initialValue: defaultPath,
      placeholder: defaultPath,
      confirmLabel: 'Extract',
      folderSuggestions,
      suggestionLabel: 'Extract to',
      applyFolderSuggestion: (path) => normalizeFolderPath(path),
      onSubmit: (value) => {
        void runAction(() => createJob({
          type: 'extract',
          sourcePath: entry.path,
          destinationPath: value.trim(),
        }), 'Extract transfer started');
      },
    });
  };

  const handleAnalyze = () => {
    const entry = selectedEntries[0];
    if (!entry || entry.type !== 'directory') return;
    setContextMenu(null);
    setAnalyzePath(entry.path);
  };

  const handleCreateChecksum = () => {
    const entry = selectedEntries[0];
    if (!entry || selectedEntries.length !== 1) return;
    setContextMenu(null);
    setTextInputDialog({
      title: 'Generate Checksum',
      label: 'Verify mode',
      initialValue: 'sha256',
      placeholder: 'sha256',
      confirmLabel: 'Generate',
      onSubmit: (value) => {
        const mode = value.trim().toLowerCase() === 'md5' ? 'md5' : 'sha256';
        void runAction(() => createJob({ type: 'checksum', sourcePath: entry.path, verifyMode: mode }), `Checksum (${mode}) transfer started`);
      },
    });
  };

  return {
    handleCreateArchive,
    handleExtractArchive,
    handleAnalyze,
    handleCreateChecksum,
  };
}
