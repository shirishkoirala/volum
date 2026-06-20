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

export type JobType = 'copy' | 'move' | 'upload' | 'extract' | 'archive' | 'checksum';
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'needs_attention';

export type ConflictItem = {
  id: string;
  jobId: string;
  sourcePath: string;
  destinationPath: string;
  sizeBytes: number;
  processedBytes: number;
  status: JobStatus;
  errorMessage?: string;
};

export type Job = {
  id: string;
  type: JobType;
  status: JobStatus;
  sourcePath?: string;
  destinationPath?: string;
  totalBytes: number;
  processedBytes: number;
  speedBytesPerSecond?: number;
  etaSeconds?: number;
  totalItems: number;
  processedItems: number;
  currentItem?: string;
  errorMessage?: string;
  conflictPolicy: string;
  verifyMode: string;
  createdAt: string;
  updatedAt: string;
};

export type JobsResponse = {
  jobs: Job[] | null;
};

export type Session = {
  authEnabled: boolean;
  authenticated: boolean;
  setupRequired?: boolean;
  userId?: string;
  username?: string;
  role?: 'admin' | 'readonly' | '';
  hasAvatar?: boolean;
  avatarVersion?: number;
};

export type AvatarState = {
  hasAvatar: boolean;
  avatarVersion: number;
};

export type UserInfo = {
  id: string;
  username: string;
  role: 'admin' | 'readonly';
};

export type ConflictPolicy = 'ask' | 'skip' | 'overwrite' | 'rename' | 'cancel' | 'skip_identical';

import { apiUrl } from './baseUrl';

export function shareUrl(token: string): string {
  return new URL(apiUrl(`/api/public/${token}`), window.location.origin).toString();
}

async function parseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({ error: response.statusText }));
  return new Error(body.error ?? response.statusText);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  });

  if (!response.ok) throw await parseError(response);

  return response.json() as Promise<T>;
}

async function requestVoid<T>(path: string, options: RequestInit = {}): Promise<void> {
  await request<T>(path, options);
}

export function getRoots() {
  return request<RootResponse>('/api/roots');
}

export function getDevices() {
  return request<DevicesResponse>('/api/devices');
}

export function getSession() {
  return request<Session>('/api/session');
}

export function profileAvatarUrl(version?: number): string {
  const suffix = version ? `?v=${version}` : '';
  return apiUrl(`/api/profile/avatar${suffix}`);
}

export async function uploadProfileAvatar(file: File): Promise<AvatarState> {
  const form = new FormData();
  form.append('avatar', file);
  const response = await fetch(apiUrl('/api/profile/avatar'), {
    method: 'PUT',
    body: form,
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<AvatarState>;
}

export function deleteProfileAvatar(): Promise<AvatarState> {
  return request<AvatarState>('/api/profile/avatar', { method: 'DELETE' });
}

export function login(username: string, password: string, rememberMe = false) {
  return request<Session>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, rememberMe })
  });
}

export function logout() {
  return request<Session>('/api/logout', {
    method: 'POST'
  });
}

export function setup(username: string, password: string) {
  return request<Session>('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export function listUsers() {
  return request<UserInfo[]>('/api/users');
}

export function createUser(username: string, password: string, role: 'admin' | 'readonly') {
  return requestVoid('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, role })
  });
}

export function deleteUser(userId: string) {
  return requestVoid(`/api/users/${userId}`, {
    method: 'DELETE'
  });
}

export function changePassword(userId: string, password: string) {
  return requestVoid(`/api/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword: password })
  });
}

export function changeRole(userId: string, role: 'admin' | 'readonly') {
  return requestVoid(`/api/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export function getFiles(path: string, hidden: boolean, options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams({ path, hidden: String(hidden) });
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  return request<FileResponse>(`/api/files?${params.toString()}`);
}

export function getTrash() {
  return request<TrashResponse>('/api/trash');
}

export function getJobs() {
  return request<JobsResponse>('/api/jobs');
}

export function createJob(params: {
  type: JobType;
  sourcePath: string;
  destinationPath?: string;
  conflictPolicy?: ConflictPolicy;
  verifyMode?: string;
}) {
  return request<Job>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function getUploadStatus(path: string, filename: string) {
  const params = new URLSearchParams({ path, filename });
  const response = await fetch(apiUrl(`/api/files/upload-status?${params.toString()}`));
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<{ filename: string; received: number; complete: boolean; jobId?: string }>;
}

type UploadChunkResponse = { received: number; complete: boolean; jobId?: string };

export async function uploadChunk(
  path: string,
  filename: string,
  offset: number,
  totalSize: number,
  chunk: Blob,
  jobId?: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ path, filename, offset: String(offset), totalSize: String(totalSize) });
  if (jobId) params.set('jobId', jobId);
  const response = await fetch(apiUrl(`/api/files/upload-chunk?${params.toString()}`), {
    method: 'POST',
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

export function cancelJob(id: string) {
  return requestVoid(`/api/jobs/${id}/cancel`, {
    method: 'POST'
  });
}

export function retryJob(id: string) {
  return requestVoid(`/api/jobs/${id}/retry`, {
    method: 'POST'
  });
}

export function retryJobItem(jobId: string, itemId: string) {
  return requestVoid(`/api/jobs/${jobId}/items/${itemId}/retry`, {
    method: 'POST'
  });
}

export function pauseJob(id: string) {
  return requestVoid(`/api/jobs/${id}/pause`, {
    method: 'POST'
  });
}

export function resumeJob(id: string) {
  return requestVoid(`/api/jobs/${id}/resume`, {
    method: 'POST'
  });
}

export function clearCompletedJobs() {
  return request<{ removed: number }>('/api/jobs/clear-completed', {
    method: 'DELETE'
  });
}

export function clearFailedJobs() {
  return request<{ removed: number }>('/api/jobs/clear-failed', {
    method: 'DELETE'
  });
}

export function getJobConflicts(id: string) {
  return request<{ items: ConflictItem[] }>(`/api/jobs/${id}/conflicts`);
}

export function resolveJobConflicts(id: string, items: Array<{ itemId: string; resolution: 'skip' | 'overwrite' | 'rename' }>, defaultResolution?: 'skip' | 'overwrite' | 'rename') {
  return request<{ status: string; resumed?: boolean }>(`/api/jobs/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ items, defaultResolution }),
  });
}

export function createFolder(path: string, name: string) {
  return request<FileEntry>('/api/files/folder', {
    method: 'POST',
    body: JSON.stringify({ path, name })
  });
}

export function createFile(path: string, name: string) {
  return request<FileEntry>('/api/files/file', {
    method: 'POST',
    body: JSON.stringify({ path, name })
  });
}

export function renamePath(path: string, newName: string) {
  return request<FileEntry>('/api/files/rename', {
    method: 'PATCH',
    body: JSON.stringify({ path, newName })
  });
}

export function chmodPath(path: string, mode: string) {
  return request<FileEntry>('/api/files/permissions', {
    method: 'PATCH',
    body: JSON.stringify({ path, mode })
  });
}

export function deletePath(path: string, confirmName: string) {
  return requestVoid('/api/files', {
    method: 'DELETE',
    body: JSON.stringify({ path, confirmName })
  });
}

export function restoreTrash(id: string) {
  return request<FileEntry>(`/api/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST'
  });
}

export function deleteTrash(id: string) {
  return requestVoid(`/api/trash/${encodeURIComponent(id)}`, {
    method: 'DELETE'
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

export type DiskUsageNode = {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  percentage: number;
  children: DiskUsageNode[];
};

export function analyzeDiskUsage(path: string) {
  const params = new URLSearchParams({ path });
  return request<DiskUsageNode>(`/api/files/analyze?${params.toString()}`);
}

export function searchFiles(query: string, limit = 50) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return request<SearchResponse>(`/api/files/search?${params.toString()}`);
}

export async function batchRename(items: { path: string; newName: string }[]) {
  return request<{ errors?: { path: string; error: string }[]; complete?: number }>('/api/files/batch-rename', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}

export type Share = {
  id: string;
  path: string;
  token: string;
  expiresAt?: string;
  maxDownloads?: number;
  downloadCount: number;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
};

export type CreateShareRequest = {
  path: string;
  password?: string;
  expiresAt?: string;
  maxDownloads?: number;
};

export function createShare(req: CreateShareRequest) {
  return request<Share>('/api/shares', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export function getShares() {
  return request<{ shares: Share[] }>('/api/shares');
}

export function deleteShare(id: string) {
  return requestVoid(`/api/shares/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

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

export function getStatus() {
  return request<StatusResponse>('/api/status');
}

export function dbVacuum() {
  return request<{ status: string }>('/api/db/vacuum', { method: 'POST' });
}

export function dbPruneJobs(olderThan?: string) {
  return pruneTable('/api/db/prune-jobs', olderThan);
}

export function dbPruneAuditLogs(olderThan?: string) {
  return pruneTable('/api/db/prune-audit-logs', olderThan);
}

function pruneTable(endpoint: string, olderThan?: string) {
  const params = olderThan ? `?olderThan=${encodeURIComponent(olderThan)}` : '';
  return request<{ removed: number }>(`${endpoint}${params}`, { method: 'POST' });
}

export type ServiceInfo = {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  healthUrl: string;
  description?: string;
  openMode?: 'embed' | 'tab';
  position: number;
  lastHealthStatus?: string;
  lastHealthCheckedAt?: string;
  lastHealthStatusCode?: number;
  lastHealthError?: string;
};

export type ServiceHealthInfo = {
  serviceId: string;
  status: 'healthy' | 'unhealthy';
  checkedAt: string;
  statusCode?: number;
  error?: string;
};

export function listFavorites() {
  return request<string[]>('/api/favorites');
}

export function addFavorite(path: string) {
  return requestVoid('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export function removeFavorite(path: string) {
  return requestVoid('/api/favorites', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });
}

export function reorderFavorites(paths: string[]) {
  return requestVoid('/api/favorites/reorder', {
    method: 'PUT',
    body: JSON.stringify({ paths }),
  });
}

export function listServices() {
  return request<ServiceInfo[]>('/api/services');
}

export function listServiceHealth() {
  return request<Record<string, ServiceHealthInfo>>('/api/services/health');
}

export function createService(name: string, url: string, iconUrl?: string, healthUrl?: string, description?: string, openMode?: string) {
  return request<ServiceInfo>('/api/services', {
    method: 'POST',
    body: JSON.stringify(serviceBody(name, url, iconUrl, healthUrl, description, openMode)),
  });
}

export function updateService(id: string, name: string, url: string, iconUrl?: string, healthUrl?: string, description?: string, openMode?: string) {
  return request<ServiceInfo>(`/api/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(serviceBody(name, url, iconUrl, healthUrl, description, openMode)),
  });
}

function serviceBody(name: string, url: string, iconUrl?: string, healthUrl?: string, description?: string, openMode?: string) {
  return { name, url, iconUrl, healthUrl, description, openMode };
}

export function deleteService(id: string) {
  return requestVoid(`/api/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function reorderServices(ids: string[]) {
  return requestVoid('/api/services/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}
