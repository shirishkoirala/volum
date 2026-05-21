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
