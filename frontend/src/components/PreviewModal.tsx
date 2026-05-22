import { useEffect, useState } from 'react';
import {
  downloadUrl,
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isVideoExtension,
  rawUrl,
  type FileEntry
} from '../api/client';
import { Icon } from './Icon';
import { Overlay } from './shared';
import styles from './Preview.module.css';

type PreviewModalProps = {
  entry: FileEntry;
  onClose: () => void;
};

export function PreviewModal({ entry, onClose }: PreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const fileUrl = rawUrl(entry.path);
  const showImage = isImageExtension(entry.name);
  const showVideo = isVideoExtension(entry.name);
  const showAudio = isAudioExtension(entry.name);
  const showText = isTextExtension(entry.name);
  const showPDF = /\.pdf$/i.test(entry.name);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!showText) {
      return;
    }
    fetch(fileUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to read file (${response.status})`);
        }
        const text = await response.text();
        setTextContent(text);
      })
      .catch((err: Error) => setTextError(err.message));
  }, [fileUrl, showText]);

  return (
    <Overlay onClose={onClose}>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <span className={styles.previewTitle}>{entry.name}</span>
          <div className={styles.previewActions}>
            <button
              className="icon-button"
              onClick={() => window.open(downloadUrl(entry.path), '_blank')}
              title="Download"
              type="button"
            >
              <Icon name="edit-download" size={18} />
            </button>
            <button
              className="icon-button"
              onClick={() => window.open(fileUrl, '_blank')}
              title="Open raw"
              type="button"
            >
              <Icon name="document-open" size={18} />
            </button>
            <button
              className="icon-button"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <Icon name="window-close" size={18} />
            </button>
          </div>
        </div>

        <div className={styles.previewContent}>
          {showImage && (
            <img
              alt={entry.name}
              className={styles.previewImage}
              src={fileUrl}
            />
          )}
          {showVideo && (
            <video
              className={styles.previewVideo}
              controls
              src={fileUrl}
            />
          )}
          {showAudio && (
            <div className={styles.previewAudioWrapper}>
              <p className={styles.previewAudioLabel}>{entry.name}</p>
              <audio controls src={fileUrl} />
            </div>
          )}
          {showText && textContent !== null && (
            <pre className={styles.previewText}><code>{textContent}</code></pre>
          )}
          {showText && textError !== null && (
            <div className={styles.previewError}>{textError}</div>
          )}
          {showPDF && (
            <iframe className={styles.previewIframe} src={fileUrl} title={entry.name} />
          )}
          {!showImage && !showVideo && !showAudio && !showText && !showPDF && (
            <div className={styles.previewUnsupported}>
              <p>No preview available for this file type.</p>
              <a href={downloadUrl(entry.path)}>Download instead</a>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}
