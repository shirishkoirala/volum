import { getUploadStatus, uploadChunk, UploadCancelledError, UploadPausedError } from '../api/client';

export const CHUNK_SIZE = 4 * 1024 * 1024;

export type UploadProgress = {
  filename: string;
  received: number;
  total: number;
};

export type UploadResult = {
  jobId: string | null;
  completed: number;
};

export async function uploadFileWithResume(
  path: string,
  file: File,
  signal?: AbortSignal,
  onProgress?: (p: UploadProgress) => void,
): Promise<string | null> {
  const status = await getUploadStatus(path, file.name);
  let jobId = status.jobId ?? null;
  let offset = status.received;

  if (offset >= file.size) return jobId;

  while (offset < file.size) {
    if (signal?.aborted) return jobId;

    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);

    const result = await uploadChunk(path, file.name, offset, file.size, chunk, jobId ?? undefined, signal);
    jobId = result.jobId ?? jobId;
    offset = result.received;
    onProgress?.({ filename: file.name, received: offset, total: file.size });
    if (result.complete) return jobId;
  }

  return jobId;
}

export async function uploadFilesWithResume(
  path: string,
  files: File[],
  signal?: AbortSignal,
  onFileProgress?: (p: UploadProgress) => void,
  onFileComplete?: (filename: string) => void,
): Promise<UploadResult> {
  let completed = 0;
  let lastJobId: string | null = null;
  for (const file of files) {
    if (signal?.aborted) break;
    try {
      lastJobId = await uploadFileWithResume(path, file, signal, onFileProgress);
      completed++;
      onFileComplete?.(file.name);
    } catch (err) {
      if (err instanceof UploadCancelledError || err instanceof UploadPausedError) break;
      throw err;
    }
  }
  return { jobId: lastJobId, completed };
}
