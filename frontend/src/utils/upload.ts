import { getUploadStatus, uploadChunk, UploadCancelledError, UploadPausedError } from '../api/client';

export const CHUNK_SIZE = 1024 * 1024;

export type UploadProgress = {
  filename: string;
  received: number;
  total: number;
};

export type UploadResult = {
  jobId: string | null;
  completed: number;
  interrupted?: 'aborted' | 'cancelled' | 'paused';
};

export function unsupportedUploadReason(file: File): string | null {
  if (file.name.toLowerCase().endsWith('.app')) {
    return 'Folder and app-bundle uploads are not supported yet';
  }
  return null;
}

type UploadFileResult = {
  jobId: string | null;
  complete: boolean;
  interrupted?: UploadResult['interrupted'];
};

export async function uploadFileWithResume(
  path: string,
  file: File,
  signal?: AbortSignal,
  onProgress?: (p: UploadProgress) => void,
  onJobStarted?: (jobId: string) => void,
): Promise<UploadFileResult> {
  const status = await getUploadStatus(path, file.name);
  let jobId = status.jobId ?? null;
  let offset = status.received;
  let reportedJobId = false;

  const reportJobId = (id: string | null) => {
    if (!id || reportedJobId) return;
    reportedJobId = true;
    onJobStarted?.(id);
  };

  reportJobId(jobId);

  if (offset >= file.size) return { jobId, complete: true };

  while (offset < file.size) {
    if (signal?.aborted) return { jobId, complete: false, interrupted: 'aborted' };

    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);

    const result = await uploadChunk(path, file.name, offset, file.size, chunk, jobId ?? undefined, signal);
    jobId = result.jobId ?? jobId;
    reportJobId(jobId);
    offset = result.received;
    onProgress?.({ filename: file.name, received: offset, total: file.size });
    if (result.complete) return { jobId, complete: true };
  }

  return { jobId, complete: true };
}

export async function uploadFilesWithResume(
  path: string,
  files: File[],
  signal?: AbortSignal,
  onFileProgress?: (p: UploadProgress) => void,
  onFileComplete?: (filename: string) => void,
  onFileJobStarted?: (filename: string, jobId: string) => void,
): Promise<UploadResult> {
  let completed = 0;
  let lastJobId: string | null = null;
  for (const file of files) {
    if (signal?.aborted) return { jobId: lastJobId, completed, interrupted: 'aborted' };
    try {
      const result = await uploadFileWithResume(path, file, signal, onFileProgress, (jobId) => {
        onFileJobStarted?.(file.name, jobId);
      });
      lastJobId = result.jobId;
      if (result.interrupted) return { jobId: lastJobId, completed, interrupted: result.interrupted };
      if (result.complete) {
        completed++;
        onFileComplete?.(file.name);
      }
    } catch (err) {
      if (err instanceof UploadCancelledError) return { jobId: lastJobId, completed, interrupted: 'cancelled' };
      if (err instanceof UploadPausedError) return { jobId: lastJobId, completed, interrupted: 'paused' };
      throw err;
    }
  }
  return { jobId: lastJobId, completed };
}
