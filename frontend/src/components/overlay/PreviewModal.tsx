import { useEffect, useState } from 'react';
import {
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isVideoExtension,
} from '../../utils/fileTypes';
import { downloadUrl, rawUrl } from '../../api/client';
import type { FileEntry } from '../../api/client';
import { previewBlockedReason } from '../../utils/preview';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/shared';
import { Dialog } from './Dialog';
import styles from './Preview.module.css';

type CopyStatus = 'idle' | 'copied' | 'failed';

function PreviewImage({ alt, src }: { alt: string; src: string }) {
  return <img alt={alt} className={styles.previewImage} src={src} />;
}

function PreviewVideo({ src }: { src: string }) {
  return <video className={styles.previewVideo} controls preload="metadata" src={src} />;
}

function PreviewAudio({ name, src }: { name: string; src: string }) {
  return (
    <div className={styles.previewAudioWrapper}>
      <p className={styles.previewAudioLabel}>{name}</p>
      <audio controls preload="metadata" src={src} />
    </div>
  );
}

function PreviewFrame({ name, src }: { name: string; src: string }) {
  return <iframe className={styles.previewIframe} sandbox="" src={src} title={name} />;
}

type PreviewModalProps = {
  entry: FileEntry;
  onClose: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  positionLabel?: string;
};

type PreviewContentProps = {
  entry: FileEntry;
  onClose?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  positionLabel?: string;
};

export function PreviewContent({
  entry,
  onClose,
  onDownload,
  onShare,
  onPrevious,
  onNext,
  previousDisabled = true,
  nextDisabled = true,
  positionLabel,
}: PreviewContentProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

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

  useEffect(() => {
    if (!onPrevious && !onNext) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && onPrevious && !previousDisabled) {
        event.preventDefault();
        onPrevious();
      }
      if (event.key === 'ArrowRight' && onNext && !nextDisabled) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextDisabled, onNext, onPrevious, previousDisabled]);

  useEffect(() => {
    setCopyStatus('idle');
  }, [entry.path]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const copyPathFallback = () => {
    const textArea = document.createElement('textarea');
    textArea.value = entry.path;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  };

  const handleCopyPath = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(entry.path);
        setCopyStatus('copied');
        return;
      }
    } catch {
      // Fall back below for browsers that block async clipboard writes.
    }

    setCopyStatus(copyPathFallback() ? 'copied' : 'failed');
  };

  const copyTitle =
    copyStatus === 'copied' ? 'Path copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy path';

  return (
    <div className={styles.previewShell}>
      <div className={styles.previewHeader}>
        <div className={styles.previewTitleGroup}>
          <span className={styles.previewTitle}>Preview</span>
          <span className={styles.previewMeta}>
            <span className={styles.previewFileName}>{entry.name}</span>
            {positionLabel && <span className={styles.previewPosition}>{positionLabel}</span>}
          </span>
        </div>
        <div className={styles.previewActions}>
          {onPrevious && (
            <IconButton onClick={onPrevious} disabled={previousDisabled} title="Previous file">
              <Icon name="go-previous" size={18} className={styles.previousIcon} />
            </IconButton>
          )}
          {onNext && (
            <IconButton onClick={onNext} disabled={nextDisabled} title="Next file">
              <Icon name="go-next" size={18} />
            </IconButton>
          )}
          <IconButton
            onClick={() => {
              void handleCopyPath();
            }}
            title={copyTitle}
          >
            <Icon name="edit-copy" size={18} />
          </IconButton>
          {onShare && (
            <IconButton onClick={onShare} title="Share">
              <Icon name="mail-send" size={18} />
            </IconButton>
          )}
          <IconButton onClick={() => onDownload?.()} title="Download">
            <Icon name="edit-download" size={18} />
          </IconButton>
          <IconButton
            onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
            title="Open raw"
          >
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
            <a href={downloadUrl(entry.path)} target="_blank" rel="noopener noreferrer">
              Download instead
            </a>
          </div>
        )}
        {!previewBlocked && showImage && <PreviewImage alt={entry.name} src={fileUrl} />}
        {!previewBlocked && showVideo && <PreviewVideo src={fileUrl} />}
        {!previewBlocked && showAudio && <PreviewAudio name={entry.name} src={fileUrl} />}
        {!previewBlocked && showText && textContent !== null && (
          <pre className={styles.previewText}>
            <code>{textContent}</code>
          </pre>
        )}
        {!previewBlocked && showText && textError !== null && (
          <div className={styles.previewError}>{textError}</div>
        )}
        {!previewBlocked && showPDF && <PreviewFrame name={entry.name} src={fileUrl} />}
        {!previewBlocked && !showImage && !showVideo && !showAudio && !showText && !showPDF && (
          <div className={styles.previewUnsupported}>
            <p>No preview available for this file type.</p>
            <a href={downloadUrl(entry.path)} target="_blank" rel="noopener noreferrer">
              Download instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function PreviewModal({
  entry,
  onClose,
  onDownload,
  onShare,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  positionLabel,
}: PreviewModalProps) {
  return (
    <Dialog hideHeader width="xl" onClose={onClose}>
      <PreviewContent
        entry={entry}
        onClose={onClose}
        onDownload={onDownload}
        onShare={onShare}
        onPrevious={onPrevious}
        onNext={onNext}
        previousDisabled={previousDisabled}
        nextDisabled={nextDisabled}
        positionLabel={positionLabel}
      />
    </Dialog>
  );
}
