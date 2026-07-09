import type {
  BlockDevice,
  FileEntry,
  Job,
  RootEntry,
  ServiceInfo,
  Session,
} from '../api/client';

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

export function buildRootEntry(overrides: Partial<RootEntry> = {}): RootEntry {
  return {
    path: '/storage',
    discovered: false,
    available: true,
    totalBytes: 0,
    freeBytes: 0,
    usedBytes: 0,
    isHome: false,
    ...overrides,
  };
}

export function buildBlockDevice(overrides: Partial<BlockDevice> = {}): BlockDevice {
  return {
    name: 'sda1',
    size: '100G',
    type: 'disk',
    mountPoint: '/mnt/data',
    fsType: 'ext4',
    rotational: false,
    totalBytes: 1_000_000_000,
    usedBytes: 400_000_000,
    freeBytes: 600_000_000,
    ...overrides,
  };
}

export function buildServiceInfo(overrides: Partial<ServiceInfo> = {}): ServiceInfo {
  return {
    id: 'svc-1',
    name: 'Test Service',
    url: 'https://example.com',
    iconUrl: '',
    healthUrl: '',
    position: 1,
    ...overrides,
  };
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
