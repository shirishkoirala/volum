import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/shared';
import type { ServiceShortcut } from '../../utils/services';
import { validUrl, detectFavicon } from '../../utils/services';
import dStyles from './Dialogs.module.css';

type FaviconStatus = 'idle' | 'detecting' | 'found' | 'not-found';

type ServiceFormModalProps = {
  initial?: ServiceShortcut;
  onSave: (data: { name: string; url: string; iconUrl?: string }) => void;
  onClose: () => void;
};

export function ServiceFormModal({ initial, onSave, onClose }: ServiceFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, url: false });
  const [faviconStatus, setFaviconStatus] = useState<FaviconStatus>('idle');
  const [debouncedUrl, setDebouncedUrl] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-svc-autofocus]');
      input?.focus();
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUrl(url.trim()), 800);
    return () => clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    if (!debouncedUrl || !validUrl(debouncedUrl)) {
      setFaviconStatus('idle');
      return;
    }
    let cancelled = false;
    setFaviconStatus('detecting');
    detectFavicon(debouncedUrl).then((found) => {
      if (cancelled) return;
      if (found) {
        setFaviconStatus('found');
        setIconUrl(found);
      } else {
        setFaviconStatus('not-found');
      }
    });
    return () => { cancelled = true; };
  }, [debouncedUrl]);

  const handleSubmit = () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!url.trim()) { setError('URL is required.'); return; }
    if (!validUrl(url.trim())) { setError('Enter a valid http:// or https:// URL.'); return; }
    onClose();
    onSave({ name: name.trim(), url: url.trim(), iconUrl: iconUrl.trim() || undefined });
  };

  const urlError = touched.url && url.trim() && !validUrl(url.trim())
    ? 'Must be a valid http:// or https:// URL'
    : null;

  return (
    <Dialog title={initial ? 'Edit Service' : 'Add Service'} onClose={onClose} footer={
      <>
        <Button size="compact" onClick={onClose}>Cancel</Button>
        <Button size="compact" variant="primary" onClick={handleSubmit}>
          {initial ? 'Save' : 'Add'}
        </Button>
      </>
    }>
      <label className={dStyles.dialogField}>
        <span>Name</span>
        <input
          data-svc-autofocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onBlur={() => setTouched((p) => ({ ...p, name: true }))}
          placeholder="e.g. Plex"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />
      </label>
      <label className={dStyles.dialogField}>
        <span>URL</span>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onBlur={() => setTouched((p) => ({ ...p, url: true }))}
          placeholder="https://plex.example.com:32400"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />
        {urlError && <p className={dStyles.dialogError}>{urlError}</p>}
      </label>
      <label className={dStyles.dialogField}>
        <span>Icon URL (optional)</span>
        <div className={dStyles.iconUrlRow}>
          <input
            value={iconUrl}
            onChange={(e) => { setIconUrl(e.target.value); setError(null); }}
            placeholder="https://example.com/favicon.ico"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
          {faviconStatus === 'found' && iconUrl && (
            <img src={iconUrl} alt="" className={dStyles.faviconPreview} />
          )}
        </div>
        <div className={dStyles.faviconStatusRow}>
          {faviconStatus === 'detecting' && (
            <span className={`${dStyles.faviconStatus} ${dStyles.faviconDetecting}`}>
              <span className={dStyles.detectingSpinner} /> Detecting favicon…
            </span>
          )}
          {faviconStatus === 'found' && (
            <span className={`${dStyles.faviconStatus} ${dStyles.faviconFound}`}>
              Favicon detected
            </span>
          )}
          {faviconStatus === 'not-found' && (
            <span className={`${dStyles.faviconStatus} ${dStyles.faviconNotFound}`}>
              No favicon found — globe will be used
            </span>
          )}
          {faviconStatus === 'idle' && (
            <span className={dStyles.dialogHelp}>Leave empty to auto-detect from URL</span>
          )}
        </div>
      </label>
      {error && <p className={dStyles.dialogError}>{error}</p>}
    </Dialog>
  );
}
