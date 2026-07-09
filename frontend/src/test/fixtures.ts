import type { FileEntry, Job, Session } from '../api/client';

export function buildFileEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'file.txt',
    path: '/storage/file.txt',
    type: 'file',
    size: 1024,
    modifiedAt: '2026-01-01T00:00:00Z',
    permissions: '-rw-r--r--',
    owner: '1000',
    group: '1000',
    hidden: false,
    ...overrides,
  };
}

export function buildDirectoryEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return buildFileEntry({
    name: 'folder',
    path: '/storage/folder',
    type: 'directory',
    ...overrides,
  });
}

export function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    type: 'copy',
    sourcePath: '/source',
    destinationPath: '/destination',
    status: 'completed',
    totalBytes: 1000,
    processedBytes: 1000,
    totalItems: 1,
    processedItems: 1,
    conflictPolicy: 'ask',
    verifyMode: 'none',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:01:00Z',
    ...overrides,
  };
}

export function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    authEnabled: true,
    authenticated: true,
    role: 'admin',
    ...overrides,
  };
}
