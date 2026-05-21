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

export type UploadResponse = {
  jobs: Job[] | null;
};

export type Session = {
  authEnabled: boolean;
  authenticated: boolean;
  role?: 'admin' | 'readonly' | '';
};

export type ConflictPolicy = 'ask' | 'skip' | 'overwrite' | 'rename' | 'cancel';

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

export function getSession() {
  return request<Session>('/api/session');
}

export function login(role: 'admin' | 'readonly', password: string) {
  return request<Session>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ role, password })
  });
}

export function logout() {
  return request<Session>('/api/logout', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function getFiles(path: string, hidden: boolean) {
  const params = new URLSearchParams({ path, hidden: String(hidden) });
  return request<FileResponse>(`/api/files?${params.toString()}`);
}

export function getJobs() {
  return request<JobsResponse>('/api/jobs');
}

export function createCopyJob(sourcePath: string, destinationPath: string, conflictPolicy: ConflictPolicy = 'ask') {
  return request<Job>('/api/jobs/copy', {
    method: 'POST',
    body: JSON.stringify({
      sourcePath,
      destinationPath,
      conflictPolicy,
      verifyMode: 'size'
    })
  });
}

export function createMoveJob(sourcePath: string, destinationPath: string, conflictPolicy: ConflictPolicy = 'ask') {
  return request<Job>('/api/jobs/move', {
    method: 'POST',
    body: JSON.stringify({
      sourcePath,
      destinationPath,
      conflictPolicy,
      verifyMode: 'size'
    })
  });
}

export async function uploadFiles(path: string, files: File[]) {
  const formData = new FormData();
  formData.append(
    'manifest',
    JSON.stringify(files.map((file) => ({ name: file.name, size: file.size })))
  );
  for (const file of files) {
    formData.append('files', file, file.name);
  }
  const params = new URLSearchParams({ path });
  const response = await fetch(`/api/files/upload?${params.toString()}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? response.statusText);
  }

  return response.json() as Promise<UploadResponse>;
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

export function deletePath(path: string, confirmName: string) {
  return requestVoid('/api/files', {
    method: 'DELETE',
    body: JSON.stringify({ path, confirmName })
  });
}

export function downloadUrl(path: string) {
  const params = new URLSearchParams({ path });
  return `/api/files/download?${params.toString()}`;
}

export function rawUrl(path: string) {
  const params = new URLSearchParams({ path });
  return `/api/files/raw?${params.toString()}`;
}

export function isImageExtension(name: string) {
  return /\.(avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(name);
}

export function isVideoExtension(name: string) {
  return /\.(avi|flv|m4v|mkv|mov|mp4|mpeg|mpg|ogv|webm|wmv)$/i.test(name);
}

export function isAudioExtension(name: string) {
  return /\.(aac|flac|m4a|mp3|ogg|opus|wav|wma)$/i.test(name);
}

export function isTextExtension(name: string) {
  return /\.(cfg|conf|csv|css|env|go|html?|ini|java|jsx?|json|log|md|php|properties|py|rb|rst|sh|sql|svg|toml|tsx?|txt|xml|ya?ml)$/i.test(name);
}
