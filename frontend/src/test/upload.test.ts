import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { unsupportedUploadReason, uploadFileWithResume, uploadFilesWithResume } from '../utils/upload';
import * as client from '../api/client';
import * as baseUrl from '../api/baseUrl';

vi.mock('../api/client', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod!,
    getUploadStatus: vi.fn(),
    uploadChunk: vi.fn(),
  };
});

const mockGetUploadStatus = vi.mocked(client.getUploadStatus);
const mockUploadChunk = vi.mocked(client.uploadChunk);

function createFile(size = 100, name = 'test.txt'): File {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; i++) buf[i] = i & 0xff;
  return new File([buf], name);
}

const UploadCancelledError = client.UploadCancelledError;
const UploadPausedError = client.UploadPausedError;

describe('upload utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unsupportedUploadReason', () => {
    it('rejects app bundles before upload starts', () => {
      const file = new File([], 'Nextcloud.app');
      expect(unsupportedUploadReason(file)).toBe('Folder and app-bundle uploads are not supported yet');
    });

    it('rejects app bundles case-insensitively', () => {
      const file = new File([], 'Example.APP');
      expect(unsupportedUploadReason(file)).toBe('Folder and app-bundle uploads are not supported yet');
    });

    it('allows ordinary zero-byte files', () => {
      const file = new File([], 'empty.txt');
      expect(unsupportedUploadReason(file)).toBeNull();
    });
  });

  describe('uploadFileWithResume', () => {
    it('uploads a file in a single chunk', async () => {
      const file = createFile(500);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 0, complete: false });
      mockUploadChunk.mockResolvedValue({ received: 500, complete: true, jobId: 'job-1' });

      const result = await uploadFileWithResume('/target', file);

      expect(result).toEqual({ jobId: 'job-1', complete: true });
      expect(mockGetUploadStatus).toHaveBeenCalledWith('/target', 'test.txt');
      expect(mockUploadChunk).toHaveBeenCalledTimes(1);
      expect(mockUploadChunk).toHaveBeenCalledWith('/target', 'test.txt', 0, 500, expect.any(Blob), undefined, undefined);
    });

    it('uploads a multi-chunk file (2 MB span)', async () => {
      const fileSize = 3 * 1024 * 1024 + 100;
      const file = createFile(fileSize, 'large.bin');
      mockGetUploadStatus.mockResolvedValue({ filename: 'large.bin', received: 0, complete: false });
      mockUploadChunk
        .mockResolvedValueOnce({ received: 1024 * 1024, complete: false, jobId: 'job-1' })
        .mockResolvedValueOnce({ received: 2 * 1024 * 1024, complete: false, jobId: 'job-1' })
        .mockResolvedValueOnce({ received: fileSize, complete: true, jobId: 'job-1' });

      const result = await uploadFileWithResume('/target', file);

      expect(result).toEqual({ jobId: 'job-1', complete: true });
      expect(mockUploadChunk).toHaveBeenCalledTimes(3);
    });

    it('resumes from existing partial upload', async () => {
      const file = createFile(2000);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 500, complete: false, jobId: 'job-1' });
      mockUploadChunk.mockResolvedValue({ received: 2000, complete: true, jobId: 'job-1' });

      const result = await uploadFileWithResume('/target', file);

      expect(result).toEqual({ jobId: 'job-1', complete: true });
      expect(mockUploadChunk).toHaveBeenCalledWith('/target', 'test.txt', 500, 2000, expect.any(Blob), 'job-1', undefined);
    });

    it('returns early if file is already fully received', async () => {
      const file = createFile(100);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 100, complete: true, jobId: 'job-1' });

      const result = await uploadFileWithResume('/target', file);

      expect(result).toEqual({ jobId: 'job-1', complete: true });
      expect(mockUploadChunk).not.toHaveBeenCalled();
    });

    it('reports progress via callback', async () => {
      const file = createFile(1500);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 0, complete: false });
      mockUploadChunk
        .mockResolvedValueOnce({ received: 1024, complete: false, jobId: 'job-1' })
        .mockResolvedValueOnce({ received: 1500, complete: true, jobId: 'job-1' });

      const progressCb = vi.fn();
      await uploadFileWithResume('/target', file, undefined, progressCb);

      expect(progressCb).toHaveBeenCalledTimes(2);
      expect(progressCb).toHaveBeenNthCalledWith(1, { filename: 'test.txt', received: 1024, total: 1500 });
      expect(progressCb).toHaveBeenNthCalledWith(2, { filename: 'test.txt', received: 1500, total: 1500 });
    });

    it('reports job id via callback on first chunk', async () => {
      const file = createFile(500);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 0, complete: false });
      mockUploadChunk.mockResolvedValue({ received: 500, complete: true, jobId: 'job-1' });

      const jobStartedCb = vi.fn();
      await uploadFileWithResume('/target', file, undefined, undefined, jobStartedCb);

      expect(jobStartedCb).toHaveBeenCalledWith('job-1');
    });

    it('reports job id for resumed upload on startup', async () => {
      const file = createFile(100);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 50, complete: false, jobId: 'job-resumed' });
      mockUploadChunk.mockResolvedValue({ received: 100, complete: true, jobId: 'job-resumed' });

      const jobStartedCb = vi.fn();
      await uploadFileWithResume('/target', file, undefined, undefined, jobStartedCb);

      expect(jobStartedCb).toHaveBeenCalledWith('job-resumed');
    });

    it('cancels mid-upload when signal is aborted', async () => {
      const file = createFile(3000);
      type ChunkResponse = { received: number; complete: boolean; jobId?: string };
      type StatusResponse = { filename: string; received: number; complete: boolean; jobId?: string };

      let resolveChunk: (v: ChunkResponse) => void;
      const chunkPromise = new Promise<ChunkResponse>((resolve) => { resolveChunk = resolve; });

      let resolveStatus: (v: StatusResponse) => void;
      const statusPromise = new Promise<StatusResponse>((resolve) => { resolveStatus = resolve; });

      mockGetUploadStatus.mockImplementationOnce(() => statusPromise);
      mockUploadChunk.mockImplementationOnce(() => chunkPromise);

      const controller = new AbortController();
      const uploadPromise = uploadFileWithResume('/target', file, controller.signal);

      resolveStatus!({ filename: 'test.txt', received: 0, complete: false });
      await vi.waitFor(() => expect(mockUploadChunk).toHaveBeenCalled());

      controller.abort();
      resolveChunk!({ received: 1024, complete: false, jobId: 'job-1' });

      const result = await uploadPromise;
      expect(result).toEqual({ jobId: 'job-1', complete: false, interrupted: 'aborted' });
    });

    it('propagates UploadCancelledError (handled by uploadFilesWithResume)', async () => {
      const file = createFile(500);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 0, complete: false });
      mockUploadChunk.mockRejectedValue(new UploadCancelledError('test.txt'));

      await expect(uploadFileWithResume('/target', file)).rejects.toThrow(UploadCancelledError);
    });

    it('propagates UploadPausedError (handled by uploadFilesWithResume)', async () => {
      const file = createFile(500);
      mockGetUploadStatus.mockResolvedValue({ filename: 'test.txt', received: 0, complete: false });
      mockUploadChunk.mockRejectedValue(new UploadPausedError('test.txt'));

      await expect(uploadFileWithResume('/target', file)).rejects.toThrow(UploadPausedError);
    });
  });

  describe('uploadFilesWithResume', () => {
    it('uploads multiple files sequentially', async () => {
      const file1 = createFile(100, 'a.txt');
      const file2 = createFile(200, 'b.txt');
      mockGetUploadStatus
        .mockResolvedValueOnce({ filename: 'a.txt', received: 0, complete: false })
        .mockResolvedValueOnce({ filename: 'b.txt', received: 0, complete: false });
      mockUploadChunk
        .mockResolvedValueOnce({ received: 100, complete: true, jobId: 'job-a' })
        .mockResolvedValueOnce({ received: 200, complete: true, jobId: 'job-b' });

      const result = await uploadFilesWithResume('/target', [file1, file2]);

      expect(result).toEqual({ jobId: 'job-b', completed: 2 });
      expect(mockGetUploadStatus).toHaveBeenCalledTimes(2);
      expect(mockUploadChunk).toHaveBeenCalledTimes(2);
    });

    it('reports per-file progress', async () => {
      const file1 = createFile(100, 'a.txt');
      const file2 = createFile(100, 'b.txt');
      mockGetUploadStatus
        .mockResolvedValueOnce({ filename: 'a.txt', received: 0, complete: false })
        .mockResolvedValueOnce({ filename: 'b.txt', received: 0, complete: false });
      mockUploadChunk
        .mockResolvedValueOnce({ received: 100, complete: true, jobId: 'job-a' })
        .mockResolvedValueOnce({ received: 100, complete: true, jobId: 'job-b' });

      const onFileComplete = vi.fn();
      const onFileJobStarted = vi.fn();
      await uploadFilesWithResume('/target', [file1, file2], undefined, undefined, onFileComplete, onFileJobStarted);

      expect(onFileComplete).toHaveBeenCalledTimes(2);
      expect(onFileComplete).toHaveBeenNthCalledWith(1, 'a.txt');
      expect(onFileComplete).toHaveBeenNthCalledWith(2, 'b.txt');
      expect(onFileJobStarted).toHaveBeenCalledTimes(2);
      expect(onFileJobStarted).toHaveBeenNthCalledWith(1, 'a.txt', 'job-a');
      expect(onFileJobStarted).toHaveBeenNthCalledWith(2, 'b.txt', 'job-b');
    });

    it('aborts remaining files when signal fires mid-batch', async () => {
      const file1 = createFile(100, 'a.txt');
      const file2 = createFile(100, 'b.txt');
      const file3 = createFile(100, 'c.txt');

      type ChunkResponse2 = { received: number; complete: boolean; jobId?: string };
      type StatusResponse2 = { filename: string; received: number; complete: boolean; jobId?: string };

      let resolveChunk: (v: ChunkResponse2) => void;
      const chunkPromise = new Promise<ChunkResponse2>((resolve) => { resolveChunk = resolve; });

      let resolveStatus: (v: StatusResponse2) => void;
      const statusPromise = new Promise<StatusResponse2>((resolve) => { resolveStatus = resolve; });

      mockGetUploadStatus.mockImplementationOnce(() => statusPromise);
      mockUploadChunk.mockImplementationOnce(() => chunkPromise);

      const controller = new AbortController();
      const promise = uploadFilesWithResume('/target', [file1, file2, file3], controller.signal);

      resolveStatus!({ filename: 'a.txt', received: 0, complete: false });
      await vi.waitFor(() => expect(mockUploadChunk).toHaveBeenCalled());

      controller.abort();
      resolveChunk!({ received: 100, complete: true, jobId: 'job-a' });

      const result = await promise;
      expect(result).toEqual({ jobId: 'job-a', completed: 1, interrupted: 'aborted' });
    });

    it('returns with cancelled interruption on UploadCancelledError', async () => {
      const file1 = createFile(100, 'a.txt');
      const file2 = createFile(100, 'b.txt');
      mockGetUploadStatus
        .mockResolvedValueOnce({ filename: 'a.txt', received: 0, complete: false })
        .mockResolvedValueOnce({ filename: 'b.txt', received: 0, complete: false });
      mockUploadChunk
        .mockResolvedValueOnce({ received: 100, complete: true, jobId: 'job-a' })
        .mockRejectedValueOnce(new UploadCancelledError('b.txt'));

      const result = await uploadFilesWithResume('/target', [file1, file2]);

      expect(result).toEqual({ jobId: 'job-a', completed: 1, interrupted: 'cancelled' });
    });

    it('returns with paused interruption on UploadPausedError', async () => {
      const file1 = createFile(100, 'a.txt');
      mockGetUploadStatus
        .mockResolvedValueOnce({ filename: 'a.txt', received: 0, complete: false });
      mockUploadChunk
        .mockRejectedValueOnce(new UploadPausedError('a.txt'));

      const result = await uploadFilesWithResume('/target', [file1]);

      expect(result).toEqual({ jobId: null, completed: 0, interrupted: 'paused' });
    });

    it('propagates unexpected errors', async () => {
      const file = createFile(100, 'bad.txt');
      mockGetUploadStatus.mockRejectedValue(new Error('Network failure'));

      await expect(uploadFilesWithResume('/target', [file])).rejects.toThrow('Network failure');
    });
  });
});

describe('apiUrl path prefix', () => {
  const ORIGINAL_VITE = import.meta.env.VITE_PUBLIC_PATH;

  afterEach(() => {
    import.meta.env.VITE_PUBLIC_PATH = ORIGINAL_VITE;
  });

  it('returns unchanged path when no prefix is set', () => {
    import.meta.env.VITE_PUBLIC_PATH = '';
    expect(baseUrl.apiUrl('/api/files')).toBe('/api/files');
    expect(baseUrl.apiUrl('/api/files/upload-chunk?path=/&filename=a.txt')).toBe('/api/files/upload-chunk?path=/&filename=a.txt');
  });

  it('prefixes path when VITE_PUBLIC_PATH is set', () => {
    import.meta.env.VITE_PUBLIC_PATH = '/volum';
    expect(baseUrl.apiUrl('/api/files')).toBe('/volum/api/files');
  });

  it('handles trailing slash in public path', () => {
    import.meta.env.VITE_PUBLIC_PATH = '/volum/';
    expect(baseUrl.apiUrl('/api/files')).toBe('/volum/api/files');
  });

  it('builds unprefixed absolute share URLs when no prefix is set', () => {
    import.meta.env.VITE_PUBLIC_PATH = '';
    expect(client.shareUrl('abc123')).toBe(`${window.location.origin}/api/public/abc123`);
  });

  it('builds prefixed absolute share URLs when VITE_PUBLIC_PATH is set', () => {
    import.meta.env.VITE_PUBLIC_PATH = '/volum';
    expect(client.shareUrl('abc123')).toBe(`${window.location.origin}/volum/api/public/abc123`);
  });

  it('assetUrl constructs correct asset path', () => {
    import.meta.env.VITE_PUBLIC_PATH = '';
    expect(baseUrl.assetUrl('assets/logo.png')).toBe('/assets/logo.png');

    import.meta.env.VITE_PUBLIC_PATH = '/volum';
    expect(baseUrl.assetUrl('assets/logo.png')).toBe('/volum/assets/logo.png');
  });
});
