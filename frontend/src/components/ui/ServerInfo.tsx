import type { StatusResponse } from '../../api/client';
import { formatBytes, formatUptime } from '../../utils/format';
import styles from './ServerInfo.module.css';

type ServerInfoProps = {
  status: StatusResponse;
};

export function ServerInfo({ status }: ServerInfoProps) {
  return (
    <>
      <section className={styles.section}>
        <h4>Server</h4>
        <dl className={styles.details}>
          <dt>Version</dt>
          <dd>{status.version}</dd>
          <dt>Build</dt>
          <dd>{status.buildTime || 'Unknown'}</dd>
          <dt>Runtime</dt>
          <dd>{status.goVersion}</dd>
          <dt>Uptime</dt>
          <dd>{formatUptime(status.uptime)}</dd>
          <dt>Worker</dt>
          <dd>
            <span className={styles.workerStatus}>
              <span className={`${styles.statusDot} ${status.jobCounts.active > 0 ? styles.dotBusy : styles.dotIdle}`} />
              {status.jobCounts.active > 0 ? 'Busy' : 'Idle'}
            </span>
          </dd>
        </dl>
      </section>

      <section className={styles.section}>
        <h4>Database</h4>
        <dl className={styles.details}>
          <dt>Path</dt>
          <dd>{status.dbPath}</dd>
          <dt>Size</dt>
          <dd>{formatBytes(status.dbSize)}</dd>
        </dl>
      </section>
    </>
  );
}
