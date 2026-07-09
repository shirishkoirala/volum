import type { StatusResponse } from '../../api/client';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsAboutProps = {
  status: StatusResponse;
};

export function SettingsAbout({ status }: SettingsAboutProps) {
  return (
    <section className={styles.settingsSection}>
      <h4>About</h4>
      <dl className={styles.settingsDetails}>
        <dt>Version</dt>
        <dd>{status.version}</dd>
        <dt>Build</dt>
        <dd>{status.buildTime || 'Unknown'}</dd>
        <dt>Runtime</dt>
        <dd>{status.goVersion}</dd>
      </dl>
    </section>
  );
}
