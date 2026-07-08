import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton, IconImg } from '../ui/shared';
import styles from './ServiceWindow.module.css';

type ServiceWindowProps = {
  name: string;
  url: string;
  iconUrl?: string;
};

export function ServiceWindow({ name, url, iconUrl }: ServiceWindowProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [embedFailed, setEmbedFailed] = useState(false);
  const origin = useMemo(() => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  }, [url]);

  const openExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    setLoading(true);
    setEmbedFailed(false);
    const timer = window.setTimeout(() => {
      setEmbedFailed(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [reloadKey, url]);

  const handleLoad = () => {
    setLoading(false);
    setEmbedFailed(false);
  };

  return (
    <section className={styles.serviceWindow} aria-label={name}>
      <div className={styles.toolbar}>
        <div className={styles.address}>
          {iconUrl && (
            <IconImg src={iconUrl} alt="" width={20} height={20} className={styles.serviceIcon} />
          )}
          <span className={styles.serviceName}>{name}</span>
          <span className={styles.origin}>{origin}</span>
        </div>
        <div className={styles.actions}>
          <IconButton
            aria-label={`Reload ${name}`}
            title="Reload"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <Icon name="view-refresh" size={16} />
          </IconButton>
          <Button size="compact" onClick={openExternal}>
            <Icon name="internet-web-browser" size={15} /> Open in browser
          </Button>
        </div>
      </div>
      <div className={styles.frameWrapper}>
        {loading && (
          <div className={styles.loadingOverlay} role="status" aria-live="polite">
            <Icon name="view-refresh" size={18} className={styles.spinner} />
            <span>Loading {name}</span>
          </div>
        )}
        <iframe
          key={reloadKey}
          className={styles.frame}
          src={url}
          title={name}
          onLoad={handleLoad}
          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {embedFailed && (
        <div className={styles.embedHint}>
          This service may block embedding. Use Open in browser.
        </div>
      )}
    </section>
  );
}
