import type { ReactNode } from 'react';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsSectionProps = {
  title: ReactNode;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className={styles.settingsSection}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}
