import { useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton } from '../ui/shared';
import styles from './ServiceWindow.module.css';

type ServiceWindowProps = {
  name: string;
  url: string;
};

export function ServiceWindow({ name, url }: ServiceWindowProps) {
  const [reloadKey, setReloadKey] = useState(0);
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

  return (
    <section className={styles.serviceWindow} aria-label={name}>
      <div className={styles.toolbar}>
        <div className={styles.address}>
          <span className={styles.serviceName}>{name}</span>
          <span className={styles.origin}>{origin}</span>
        </div>
        <div className={styles.actions}>
          <IconButton aria-label={`Reload ${name}`} title="Reload" onClick={() => setReloadKey((key) => key + 1)}>
            <Icon name="view-refresh" size={16} />
          </IconButton>
          <Button size="compact" onClick={openExternal}>
            <Icon name="internet-web-browser" size={15} /> Open in browser
          </Button>
        </div>
      </div>
      <iframe
        key={reloadKey}
        className={styles.frame}
        src={url}
        title={name}
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className={styles.embedHint}>
        If the page stays blank, this service may block embedding. Use Open in browser.
      </div>
    </section>
  );
}
