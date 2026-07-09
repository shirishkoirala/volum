import { ServerInfo } from '../ui/ServerInfo';
import type { StatusResponse } from '../../api/client';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsServerProps = {
  status: StatusResponse;
};

export function SettingsServer({ status }: SettingsServerProps) {
  return (
    <div className={styles.settingsSection}>
      <ServerInfo status={status} />
    </div>
  );
}
