import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Overlay } from './shared';
import { createShare, type Share } from '../api/client';
import dStyles from './Dialogs.module.css';

type ShareDialogProps = {
  path: string;
  name: string;
  onClose: () => void;
};

export function ShareDialog({ path, name, onClose }: ShareDialogProps) {
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [share, setShare] = useState<Share | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let expiresAt: string | undefined;
      if (expiresIn) {
        const n = parseInt(expiresIn, 10);
        if (!isNaN(n) && n > 0) {
          const date = new Date();
          date.setHours(date.getHours() + n);
          expiresAt = date.toISOString();
        }
      }
      const result = await createShare({
        path,
        password: password || undefined,
        expiresAt,
        maxDownloads: maxDownloads ? parseInt(maxDownloads, 10) : undefined,
      });
      setShare(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share');
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = share ? `${window.location.origin}/api/public/${share.token}` : '';

  const handleCopy = () => {
    if (copyRef.current) {
      copyRef.current.select();
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  };

  return (
    <Overlay zIndex={110} onClose={onClose}>
      <div className={dStyles.appDialog} role="dialog" aria-modal="true">
        <div className="panel-header">
          <h3>{share ? 'Share Created' : 'Create Share Link'}</h3>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <Icon name="window-close" size={18} />
          </button>
        </div>
        {share ? (
          <>
            <p className={dStyles.dialogMessage}>
              Share link for <strong>{name}</strong> ready.
            </p>
            <label className={dStyles.dialogField}>
              <span>Share URL</span>
              <div className={dStyles.dialogFieldRow}>
                <input ref={copyRef} value={shareUrl} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button type="button" className="icon-button" onClick={handleCopy} title="Copy to clipboard">
                  <Icon name="edit-copy" size={16} />
                </button>
              </div>
            </label>
            {share.expiresAt && <p className={dStyles.dialogHelp}>Expires: {new Date(share.expiresAt).toLocaleString()}</p>}
            {share.maxDownloads && <p className={dStyles.dialogHelp}>Max downloads: {share.maxDownloads}</p>}
            <div className={dStyles.dialogActions}>
              <button type="button" className={`${dStyles.dialogButton} ${dStyles.secondary}`} onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className={dStyles.dialogField}>
              <span>File / Folder</span>
              <input value={name} disabled />
            </label>
            <label className={dStyles.dialogField}>
              <span>Password (optional)</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Leave empty for no password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
              />
            </label>
            <label className={dStyles.dialogField}>
              <span>Expires in (hours, optional)</span>
              <input
                type="number"
                min="1"
                placeholder="e.g. 24"
                value={expiresIn}
                onChange={(e) => { setExpiresIn(e.target.value); setError(null); }}
              />
            </label>
            <label className={dStyles.dialogField}>
              <span>Max downloads (optional)</span>
              <input
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                value={maxDownloads}
                onChange={(e) => { setMaxDownloads(e.target.value); setError(null); }}
              />
            </label>
            {error && <p className={dStyles.dialogError}>{error}</p>}
            <div className={dStyles.dialogActions}>
              <button type="button" className={`${dStyles.dialogButton} ${dStyles.secondary}`} onClick={onClose}>Cancel</button>
              <button type="submit" className={`${dStyles.dialogButton} ${dStyles.primary}`} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Overlay>
  );
}
