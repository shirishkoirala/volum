import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton } from '../ui/shared';
import { Dialog } from './Dialog';
import { createShare, shareUrl as buildShareUrl, type Share } from '../../api/client';
import dStyles from './Dialogs.module.css';
import uiStyles from '../ui/shared.module.css';

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

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async () => {
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

  const shareUrl = share ? buildShareUrl(share.token) : '';

  const handleCopy = () => {
    if (copyRef.current) {
      copyRef.current.select();
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  };

  return (
    <Dialog title={share ? 'Share Created' : 'Create Share Link'} onClose={onClose} footer={
      share ? (
        <Button size="compact" onClick={onClose}>Close</Button>
      ) : (
        <>
          <Button size="compact" onClick={onClose}>Cancel</Button>
          <Button size="compact" variant="primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? <><Icon name="view-refresh" size={15} className={uiStyles.spin} /> Creating...</> : 'Create Share Link'}
          </Button>
        </>
      )
    }>
      {share ? (
        <>
          <p className={dStyles.dialogMessage}>
            Share link for <strong>{name}</strong> ready.
          </p>
          <label className={dStyles.dialogField}>
            <span>Share URL</span>
            <div className={dStyles.dialogFieldRow}>
              <input ref={copyRef} value={shareUrl} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
              <IconButton onClick={handleCopy} title="Copy to clipboard">
                <Icon name="edit-copy" size={16} />
              </IconButton>
            </div>
          </label>
          {share.expiresAt && <p className={dStyles.dialogHelp}>Expires: {new Date(share.expiresAt).toLocaleString()}</p>}
          {share.maxDownloads && <p className={dStyles.dialogHelp}>Max downloads: {share.maxDownloads}</p>}
        </>
      ) : (
        <>
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
        </>
      )}
    </Dialog>
  );
}
