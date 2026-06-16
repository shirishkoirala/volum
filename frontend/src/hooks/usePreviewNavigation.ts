import { useMemo } from 'react';

type PreviewableEntry = {
  path: string;
};

export function usePreviewNavigation<T extends PreviewableEntry>(
  previewEntry: T | null | undefined,
  previewEntries: T[],
) {
  const previewIndex = useMemo(() => {
    if (!previewEntry) return -1;
    return previewEntries.findIndex((entry) => entry.path === previewEntry.path);
  }, [previewEntry, previewEntries]);

  const previewPositionLabel = useMemo(() => {
    if (previewIndex < 0) return undefined;
    return `${previewIndex + 1} of ${previewEntries.length}`;
  }, [previewEntries.length, previewIndex]);

  const previousPreviewEntry = useMemo(() => {
    if (previewIndex <= 0) return undefined;
    return previewEntries[previewIndex - 1];
  }, [previewEntries, previewIndex]);

  const nextPreviewEntry = useMemo(() => {
    if (previewIndex < 0 || previewIndex >= previewEntries.length - 1) return undefined;
    return previewEntries[previewIndex + 1];
  }, [previewEntries, previewIndex]);

  return {
    previewIndex,
    previewPositionLabel,
    previousPreviewEntry,
    nextPreviewEntry,
  };
}
