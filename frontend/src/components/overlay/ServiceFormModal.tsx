import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/shared';
import type { ServiceShortcut } from '../../utils/services';
import { validUrl, detectFavicon } from '../../utils/services';
import dStyles from './Dialogs.module.css';

type FaviconStatus = 'idle' | 'detecting' | 'found' | 'not-found';

type ServiceFormModalProps = {
  initial?: ServiceShortcut;
  onSave: (data: {
    name: string;
    url: string;
    iconUrl?: string;
    healthUrl?: string;
    description?: string;
    openMode: 'embed' | 'tab';
  }) => Promise<void> | void;
  onClose: () => void;
};

export function ServiceFormModal({ initial, onSave, onClose }: ServiceFormModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl ?? '');
  const [healthUrl, setHealthUrl] = useState(initial?.healthUrl ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [openMode, setOpenMode] = useState(initial?.openMode ?? 'embed');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, url: false, healthUrl: false });
  const [faviconStatus, setFaviconStatus] = useState<FaviconStatus>('idle');
  const [debouncedUrl, setDebouncedUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    nameInputRef.current?.focus();
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
    return () => {
      cancelled = true;
    };
  }, [debouncedUrl]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!url.trim()) {
      setError('URL is required.');
      return;
    }
    if (!validUrl(url.trim())) {
      setError('Enter a valid http:// or https:// URL.');
      return;
    }
    if (healthUrl.trim() && !validUrl(healthUrl.trim())) {
      setError('Enter a valid health check http:// or https:// URL.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        url: url.trim(),
        iconUrl: iconUrl.trim() || undefined,
        healthUrl: healthUrl.trim() || undefined,
        description: description.trim() || undefined,
        openMode,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save service.');
    } finally {
      setSubmitting(false);
    }
  };

  const nameError = touched.name && !name.trim() ? 'Name is required' : null;
  const urlError = touched.url
    ? !url.trim()
      ? 'URL is required'
      : !validUrl(url.trim())
        ? 'Must be a valid http:// or https:// URL'
        : null
    : null;
  const healthUrlError =
    touched.healthUrl && healthUrl.trim() && !validUrl(healthUrl.trim())
      ? 'Must be a valid http:// or https:// URL'
      : null;

  return (
    <Dialog
      title={initial ? 'Edit Service' : 'Add Service'}
      onClose={submitting ? undefined : onClose}
      footer={
        <>
          <Button size="compact" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button size="compact" variant="primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving...' : initial ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <label className={dStyles.dialogField} htmlFor="service-name">
        <span>Name</span>
        <input
          id="service-name"
          ref={nameInputRef}
          data-svc-autofocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onBlur={() => setTouched((p) => ({ ...p, name: true }))}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? 'service-name-error' : undefined}
          placeholder="e.g. Plex"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
        />
        {nameError && (
          <p id="service-name-error" className={dStyles.dialogError} role="alert">
            {nameError}
          </p>
        )}
      </label>
      <label className={dStyles.dialogField} htmlFor="service-url">
        <span>URL</span>
        <input
          id="service-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onBlur={() => setTouched((p) => ({ ...p, url: true }))}
          aria-invalid={Boolean(urlError)}
          aria-describedby={urlError ? 'service-url-error' : undefined}
          placeholder="https://plex.example.com:32400"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
        />
        {urlError && (
          <p id="service-url-error" className={dStyles.dialogError} role="alert">
            {urlError}
          </p>
        )}
      </label>
      <label className={dStyles.dialogField} htmlFor="service-icon-url">
        <span>Icon URL (optional)</span>
        <div className={dStyles.iconUrlRow}>
          <input
            id="service-icon-url"
            aria-label="Icon URL (optional)"
            value={iconUrl}
            onChange={(e) => {
              setIconUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://example.com/favicon.ico"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
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
      <label className={dStyles.dialogField} htmlFor="service-health-url">
        <span>Health Check URL (optional)</span>
        <input
          id="service-health-url"
          aria-label="Health Check URL (optional)"
          value={healthUrl}
          onChange={(e) => {
            setHealthUrl(e.target.value);
            setError(null);
          }}
          onBlur={() => setTouched((p) => ({ ...p, healthUrl: true }))}
          aria-invalid={Boolean(healthUrlError)}
          aria-describedby={healthUrlError ? 'service-health-url-error' : 'service-health-url-help'}
          placeholder="https://example.com/health"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
        />
        {healthUrlError && (
          <p id="service-health-url-error" className={dStyles.dialogError} role="alert">
            {healthUrlError}
          </p>
        )}
        <span id="service-health-url-help" className={dStyles.dialogHelp}>
          Used only for the desktop health indicator.
        </span>
      </label>
      <label className={dStyles.dialogField} htmlFor="service-description">
        <span>Description (optional)</span>
        <textarea
          id="service-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this service"
          rows={2}
        />
      </label>
      <label className={dStyles.dialogField} htmlFor="service-open-mode">
        <span>Open in</span>
        <select
          id="service-open-mode"
          value={openMode}
          onChange={(e) => setOpenMode(e.target.value as 'embed' | 'tab')}
        >
          <option value="embed">Desktop window (embedded)</option>
          <option value="tab">New browser tab</option>
        </select>
      </label>
      {error && (
        <p className={dStyles.dialogError} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
