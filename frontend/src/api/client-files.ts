import { apiUrl } from './baseUrl';
import { parseError, request, requestVoid } from './client-base';
import type { Job } from './client-jobs';

export type BlockDevice = {
  name: string;
  size: string;
  type: string;
  mountPoint?: string;
  fsType?: string;
  label?: string;
  uuid?: string;
  model?: string;
  rotational: boolean;
  transport?: string;
  volumPath?: string;
  totalBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  partitions?: BlockDevice[];
};

export type DevicesResponse = {
  devices: BlockDevice[] | null;
};

export type RootEntry = {
  path: string;
  label?: string;
  source?: string;
  fsType?: string;
  discovered: boolean;
  available: boolean;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  isHome: boolean;
};

export type RootResponse = {
  roots: RootEntry[] | null;
};

export type FileEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
  permissions: string;
  owner: string;
  group: string;
  hidden: boolean;
};

export type FileResponse = {
  entries: FileEntry[] | null;
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
};

export type TrashEntry = {
  id: string;
  name: string;
  originalPath: string;
  trashPath: string;
  type: 'file' | 'directory';
  size: number;
  deletedAt: string;
  rootPath: string;
};

export type TrashResponse = {
  entries: TrashEntry[] | null;
};

export type SearchResult = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
  root: string;
  lineMatch?: string;
};

export type SearchResponse = {
  results: SearchResult[] | null;
};

export type DiskUsageNode = {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  percentage: number;
  children: DiskUsageNode[];
};

export type StatusResponse = {
  version: string;
  buildTime: string;
  goVersion: string;
  uptime: number;
  dbPath: string;
  dbSize: number;
  roots: RootEntry[];
  jobCounts: {
    active: number;
    completed: number;
    failed: number;
  };
};

export function getRoots() {
  return request<RootResponse>('/api/roots');
}

export function getDevices() {
  return request<DevicesResponse>('/api/devices');
}

export function getFiles(
  path: string,
  hidden: boolean,
  options?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams({ path, hidden: String(hidden) });
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  return request<FileResponse>(`/api/files?${params.toString()}`);
}

export function getTrash() {
  return request<TrashResponse>('/api/trash');
}

export function createFolder(path: string, name: string) {
  return request<FileEntry>('/api/files/folder', {
    method: 'POST',
    body: JSON.stringify({ path, name }),
  });
}

export function createFile(path: string, name: string) {
  return request<FileEntry>('/api/files/file', {
    method: 'POST',
    body: JSON.stringify({ path, name }),
  });
}

export function renamePath(path: string, newName: string) {
  return request<FileEntry>('/api/files/rename', {
    method: 'PATCH',
    body: JSON.stringify({ path, newName }),
  });
}

export function chmodPath(path: string, mode: string) {
  return request<FileEntry>('/api/files/permissions', {
    method: 'PATCH',
    body: JSON.stringify({ path, mode }),
  });
}

export function deletePath(path: string, confirmName: string) {
  return requestVoid('/api/files', {
    method: 'DELETE',
    body: JSON.stringify({ path, confirmName }),
  });
}

export function restoreTrash(id: string) {
  return request<Job>(`/api/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });
}

export function deleteTrash(id: string) {
  return requestVoid(`/api/trash/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function downloadUrl(path: string) {
  const params = new URLSearchParams({ path });
  return apiUrl(`/api/files/download?${params.toString()}`);
}

export function rawUrl(path: string) {
  const params = new URLSearchParams({ path });
  return apiUrl(`/api/files/raw?${params.toString()}`);
}

export function analyzeDiskUsage(path: string) {
  const params = new URLSearchParams({ path });
  return request<DiskUsageNode>(`/api/files/analyze?${params.toString()}`);
}

export function searchFiles(query: string, limit = 50) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return request<SearchResponse>(`/api/files/search?${params.toString()}`);
}

export async function batchRename(items: { path: string; newName: string }[]) {
  return request<{ errors?: { path: string; error: string }[]; complete?: number }>(
    '/api/files/batch-rename',
    {
      method: 'POST',
      body: JSON.stringify({ items }),
    },
  );
}

export function getStatus() {
  return request<StatusResponse>('/api/status');
}

export type UploadChunkResponse = { received: number; complete: boolean; jobId?: string };

export async function getUploadStatus(path: string, filename: string) {
  const params = new URLSearchParams({ path, filename });
  const response = await fetch(apiUrl(`/api/files/upload-status?${params.toString()}`));
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<{
    filename: string;
    received: number;
    complete: boolean;
    jobId?: string;
  }>;
}

export class UploadCancelledError extends Error {
  constructor(filename: string) {
    super(`Upload cancelled: ${filename}`);
    this.name = 'UploadCancelledError';
  }
}

export class UploadPausedError extends Error {
  constructor(filename: string) {
    super(`Upload paused: ${filename}`);
    this.name = 'UploadPausedError';
  }
}

export async function uploadChunk(
  path: string,
  filename: string,
  offset: number,
  totalSize: number,
  chunk: Blob,
  jobId?: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    path,
    filename,
    offset: String(offset),
    totalSize: String(totalSize),
  });
  if (jobId) params.set('jobId', jobId);
  const response = await fetch(apiUrl(`/api/files/upload-chunk?${params.toString()}`), {
    method: 'POST',
    headers: { 'X-Volum-Request': 'fetch' },
    body: chunk,
    signal,
  });
  if (response.status === 410) {
    throw new UploadCancelledError(filename);
  }
  if (response.status === 409) {
    throw new UploadPausedError(filename);
  }
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<UploadChunkResponse>;
}
