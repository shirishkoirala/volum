import type { Dispatch, SetStateAction } from 'react';
import type { Job } from '../api/client-jobs';
import { getJobs } from '../api/client-jobs';
import {
  unsupportedUploadReason,
  uploadFilesWithResume,
  type UploadProgress,
} from '../utils/upload';
import type { Toast } from '../components/overlay/Toast';
import type { RunAction } from './types';

interface UploadCommandDeps {
  currentPath: string;
  canWrite: boolean;
  setError: (err: string | null) => void;
  setJobs: Dispatch<SetStateAction<Job[]>>;
  setUploadProgress: Dispatch<SetStateAction<UploadProgress | null>>;
  showToastObj: (toast: Omit<Toast, 'id'>, timeout?: number) => void;
  runAction: RunAction;
}

export function useUploadCommands({
  currentPath,
  canWrite,
  setError,
  setJobs,
  setUploadProgress,
  showToastObj,
  runAction,
}: UploadCommandDeps) {
  const handleUploadFiles = (files: FileList | File[]) => {
    if (!canWrite) {
      setError('Upload requires admin permissions');
      showToastObj({
        title: 'Upload failed',
        message: 'Admin permissions required',
        variant: 'error',
      });
      return;
    }

    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    if (!currentPath) {
      setError('No destination folder selected');
      showToastObj({
        title: 'Upload failed',
        message: 'Navigate to a folder first',
        variant: 'error',
      });
      return;
    }

    const unsupportedMessage = selectedFiles.map(unsupportedUploadReason).find(Boolean);
    if (unsupportedMessage) {
      setError(unsupportedMessage);
      showToastObj({
        title: 'Upload not supported',
        message: unsupportedMessage,
        variant: 'error',
      });
      return;
    }

    setUploadProgress({
      filename: selectedFiles[0]?.name ?? 'Upload',
      received: 0,
      total: selectedFiles[0]?.size ?? 0,
    });
    showToastObj(
      {
        title: 'Upload started',
        message:
          selectedFiles.length === 1 ? selectedFiles[0]!.name : `${selectedFiles.length} files`,
        variant: 'success',
      },
      6000,
    );

    void runAction(async () => {
      try {
        const result = await uploadFilesWithResume(
          currentPath,
          selectedFiles,
          undefined,
          setUploadProgress,
        );
        if (result.interrupted) {
          showToastObj({
            title:
              result.interrupted === 'paused'
                ? 'Upload paused'
                : result.interrupted === 'cancelled'
                  ? 'Upload cancelled'
                  : 'Upload interrupted',
            message: `${result.completed} of ${selectedFiles.length} upload${selectedFiles.length === 1 ? '' : 's'} completed`,
            variant: 'warning',
          });
        } else {
          showToastObj({
            title: `${result.completed} upload${result.completed === 1 ? '' : 's'} completed`,
            variant: 'success',
          });
        }
      } finally {
        setUploadProgress(null);
      }
      const response = await getJobs();
      setJobs(response.jobs ?? []);
    });
  };

  return { handleUploadFiles };
}
