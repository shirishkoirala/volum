import { request } from './client-base';

export type JobType =
  | 'copy'
  | 'move'
  | 'upload'
  | 'extract'
  | 'archive'
  | 'checksum'
  | 'trash'
  | 'restore'
  | 'disk_analyze'
  | 'duplicate_find';
export type JobStatus =
  'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'needs_attention';

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

export type ConflictPolicy = 'ask' | 'skip' | 'overwrite' | 'rename' | 'cancel' | 'skip_identical';

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
    body: JSON.stringify(params),
  });
}

export function cancelJob(id: string) {
  return request(`/api/jobs/${id}/cancel`, {
    method: 'POST',
  });
}

export function retryJob(id: string) {
  return request(`/api/jobs/${id}/retry`, {
    method: 'POST',
  });
}

export function retryJobItem(jobId: string, itemId: string) {
  return request(`/api/jobs/${jobId}/items/${itemId}/retry`, {
    method: 'POST',
  });
}

export function pauseJob(id: string) {
  return request(`/api/jobs/${id}/pause`, {
    method: 'POST',
  });
}

export function resumeJob(id: string) {
  return request(`/api/jobs/${id}/resume`, {
    method: 'POST',
  });
}

export function clearCompletedJobs() {
  return request<{ removed: number }>('/api/jobs/clear-completed', {
    method: 'DELETE',
  });
}

export function clearFailedJobs() {
  return request<{ removed: number }>('/api/jobs/clear-failed', {
    method: 'DELETE',
  });
}

export function getJobConflicts(id: string) {
  return request<{ items: ConflictItem[] }>(`/api/jobs/${id}/conflicts`);
}

export function resolveJobConflicts(
  id: string,
  items: Array<{ itemId: string; resolution: 'skip' | 'overwrite' | 'rename' }>,
  defaultResolution?: 'skip' | 'overwrite' | 'rename',
) {
  return request<{ status: string; resumed?: boolean }>(`/api/jobs/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ items, defaultResolution }),
  });
}
