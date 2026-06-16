import { downloadUrl } from '../api/client';
import type { FileEntry } from '../api/client';
import { isImageExtension, isVideoExtension, isAudioExtension, isTextExtension } from './fileTypes';

export const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_PREVIEW_BYTES = 40 * 1024 * 1024;
export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;
export const MAX_EMBEDDED_PDF_BYTES = 50 * 1024 * 1024;

export function isPreviewableFile(name: string): boolean {
  const ext = name.toLowerCase();
  return isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext) || ext.endsWith('.pdf');
}

export function canThumbnail(entry: FileEntry): boolean {
  if (!isImageExtension(entry.name)) return false;
  if (/\.gif$/i.test(entry.name)) return false;
  return entry.size <= MAX_THUMBNAIL_BYTES;
}

export function previewBlockedReason(entry: FileEntry): string | null {
  if (isTextExtension(entry.name) && entry.size > MAX_TEXT_PREVIEW_BYTES) {
    return 'Text preview is limited to 1 MB to keep the browser responsive.';
  }
  if (isImageExtension(entry.name) && entry.size > MAX_IMAGE_PREVIEW_BYTES) {
    return 'Image preview is limited to 40 MB to avoid loading very large images into memory.';
  }
  if (/\.pdf$/i.test(entry.name) && entry.size > MAX_EMBEDDED_PDF_BYTES) {
    return 'PDF preview is limited to 50 MB to avoid loading very large documents in the browser.';
  }
  return null;
}

export function openFileExternally(path: string): void {
  window.open(downloadUrl(path), '_blank');
}
