import { downloadUrl } from '../api/client';
import { isImageExtension, isVideoExtension, isAudioExtension, isTextExtension } from './fileTypes';

export function isPreviewableFile(name: string): boolean {
  const ext = name.toLowerCase();
  return isImageExtension(ext) || isVideoExtension(ext) || isAudioExtension(ext) || isTextExtension(ext) || ext.endsWith('.pdf');
}

export function openFileExternally(path: string): void {
  window.open(downloadUrl(path), '_blank');
}
