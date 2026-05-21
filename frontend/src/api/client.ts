export type RootResponse = {
  roots: string[] | null;
};

export type FileEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
  permissions: string;
  hidden: boolean;
};

export type FileResponse = {
  entries: FileEntry[] | null;
};

export type Job = {
  id: string;
  type: string;
  status: string;
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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

async function requestVoid(url: string, options?: RequestInit): Promise<void> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? response.statusText);
  }
}

export function getRoots() {
  return request<RootResponse>('/api/roots');
}

export function getFiles(path: string, hidden: boolean) {
  const params = new URLSearchParams({ path, hidden: String(hidden) });
  return request<FileResponse>(`/api/files?${params.toString()}`);
}

export function getJobs() {
  return request<JobsResponse>('/api/jobs');
}

export function createCopyJob(sourcePath: string, destinationPath: string) {
  return request<Job>('/api/jobs/copy', {
    method: 'POST',
    body: JSON.stringify({
      sourcePath,
      destinationPath,
      conflictPolicy: 'ask',
      verifyMode: 'size'
    })
  });
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

export function createFolder(path: string, name: string) {
  return request<FileEntry>('/api/files/folder', {
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

export function deletePath(path: string) {
  return requestVoid('/api/files', {
    method: 'DELETE',
    body: JSON.stringify({ path })
  });
}

export function downloadUrl(path: string) {
  const params = new URLSearchParams({ path });
  return `/api/files/download?${params.toString()}`;
}
