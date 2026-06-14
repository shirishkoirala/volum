import { useEffect, useState } from 'react';
import { isAudioExtension, isImageExtension, isTextExtension, isVideoExtension } from '../../utils/fileTypes';
import { downloadUrl, rawUrl } from '../../api/client';
import type { FileEntry } from '../../api/client';
import { previewBlockedReason } from '../../utils/preview';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/shared';
import { Dialog } from './Dialog';
import styles from './Preview.module.css';

type PreviewModalProps = {
  entry: FileEntry;
  onClose: () => void;
  onDownload?: () => void;
};

type PreviewContentProps = {
  entry: FileEntry;
  onClose?: () => void;
  onDownload?: () => void;
};

export function PreviewContent({ entry, onClose, onDownload }: PreviewContentProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const fileUrl = rawUrl(entry.path);
  const showImage = isImageExtension(entry.name);
  const showVideo = isVideoExtension(entry.name);
  const showAudio = isAudioExtension(entry.name);
  const showText = isTextExtension(entry.name);
  const showPDF = /\.pdf$/i.test(entry.name);
  const blockedReason = previewBlockedReason(entry);
  const previewBlocked = blockedReason !== null;

  useEffect(() => {
    if (!showText || previewBlocked) return;
    const controller = new AbortController();
    setTextContent(null);
    setTextError(null);

    fetch(fileUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to read file (${response.status})`);
        setTextContent(await response.text());
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setTextError(err.message);
      });

    return () => controller.abort();
  }, [fileUrl, previewBlocked, showText]);

  return (
    <div className={styles.previewShell}>
      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>{entry.name}</span>
        <div className={styles.previewActions}>
          <IconButton onClick={() => onDownload?.()} title="Download">
            <Icon name="edit-download" size={18} />
          </IconButton>
          <IconButton onClick={() => window.open(fileUrl, '_blank')} title="Open raw">
            <Icon name="document-open" size={18} />
          </IconButton>
          {onClose && (
            <IconButton onClick={onClose} title="Close">
              <Icon name="window-close" size={18} />
            </IconButton>
          )}
        </div>
      </div>

      <div className={styles.previewContent}>
        {previewBlocked && (
          <div className={styles.previewUnsupported}>
            <p>{blockedReason}</p>
            <a href={downloadUrl(entry.path)} target="_blank" rel="noopener noreferrer">Download instead</a>
          </div>
        )}
        {!previewBlocked && showImage && <img alt={entry.name} className={styles.previewImage} src={fileUrl} />}
        {!previewBlocked && showVideo && <video className={styles.previewVideo} controls preload="metadata" src={fileUrl} />}
        {!previewBlocked && showAudio && (
          <div className={styles.previewAudioWrapper}>
            <p className={styles.previewAudioLabel}>{entry.name}</p>
            <audio controls preload="metadata" src={fileUrl} />
          </div>
        )}
        {!previewBlocked && showText && textContent !== null && (
          <pre className={styles.previewText}><code>{textContent}</code></pre>
        )}
        {!previewBlocked && showText && textError !== null && (
          <div className={styles.previewError}>{textError}</div>
        )}
        {!previewBlocked && showPDF && (
          <iframe className={styles.previewIframe} src={fileUrl} title={entry.name} />
        )}
        {!previewBlocked && !showImage && !showVideo && !showAudio && !showText && !showPDF && (
          <div className={styles.previewUnsupported}>
            <p>No preview available for this file type.</p>
            <a href={downloadUrl(entry.path)} target="_blank" rel="noopener noreferrer">Download instead</a>
          </div>
        )}
      </div>
    </div>
  );
}

export function PreviewModal({ entry, onClose, onDownload }: PreviewModalProps) {
  return (
    <Dialog hideHeader onClose={onClose}>
      <PreviewContent entry={entry} onClose={onClose} onDownload={onDownload} />
    </Dialog>
  );
}
