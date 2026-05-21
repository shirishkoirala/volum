import { useEffect, useRef, useState } from 'react';
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

type PreviewModalProps = {
  entry: FileEntry;
  onClose: () => void;
};

export function PreviewModal({ entry, onClose }: PreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
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

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div className="preview-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="preview-panel">
        <div className="preview-header">
          <span className="preview-title">{entry.name}</span>
          <div className="preview-actions">
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

        <div className="preview-content">
          {showImage && (
            <img
              alt={entry.name}
              className="preview-image"
              src={fileUrl}
            />
          )}
          {showVideo && (
            <video
              className="preview-video"
              controls
              src={fileUrl}
            />
          )}
          {showAudio && (
            <div className="preview-audio-wrapper">
              <p className="preview-audio-label">{entry.name}</p>
              <audio controls src={fileUrl} />
            </div>
          )}
          {showText && textContent !== null && (
            <pre className="preview-text"><code>{textContent}</code></pre>
          )}
          {showText && textError !== null && (
            <div className="preview-error">{textError}</div>
          )}
          {showPDF && (
            <iframe className="preview-iframe" src={fileUrl} title={entry.name} />
          )}
          {!showImage && !showVideo && !showAudio && !showText && !showPDF && (
            <div className="preview-unsupported">
              <p>No preview available for this file type.</p>
              <a href={downloadUrl(entry.path)}>Download instead</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
