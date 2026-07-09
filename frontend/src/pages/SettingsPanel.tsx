import { useMemo, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Skeleton } from '../components/ui/Skeleton';
import { AppPanel } from '../components/layout/AppPanel';
import { SettingsGeneral } from '../components/settings/SettingsGeneral';
import { SettingsServer } from '../components/settings/SettingsServer';
import { SettingsStorage } from '../components/settings/SettingsStorage';
import { SettingsDesktop } from '../components/settings/SettingsDesktop';
import { SettingsAdmin } from '../components/settings/SettingsAdmin';
import { SettingsAbout } from '../components/settings/SettingsAbout';
import { useAsyncData } from '../hooks/useAsyncData';
import { getStatus, type Session } from '../api/client';
import type { ServiceShortcut, ServiceHealthResult } from '../utils/services';
import styles from './SettingsPanel.module.css';

type SettingsPanelProps = {
  onOpenShares?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  session: Session | null;
  onSessionChange: (session: Session) => void;
  services?: ServiceShortcut[];
  serviceHealth?: Record<string, ServiceHealthResult>;
  onAddService?: () => void;
  onEditService?: (id: string) => void;
  onRemoveService?: (id: string) => void;
  onReorderServices?: (ids: string[]) => Promise<void>;
};

type CategoryId = 'general' | 'server' | 'storage' | 'desktop' | 'admin' | 'about';

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'preferences-system' },
  { id: 'server', label: 'Server', icon: 'dialog-information' },
  { id: 'storage', label: 'Storage', icon: 'drive-harddisk' },
  { id: 'desktop', label: 'Desktop', icon: 'monitor' },
  { id: 'admin', label: 'Administration', icon: 'preferences-system' },
  { id: 'about', label: 'About', icon: 'help-about' },
];

export function SettingsPanel({
  onOpenShares,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  onLogout,
  session,
  onSessionChange,
  services,
  serviceHealth,
  onAddService,
  onEditService,
  onRemoveService,
  onReorderServices,
}: SettingsPanelProps) {
  const {
    data: status,
    loading,
    error: statusError,
    refresh: loadStatus,
  } = useAsyncData(() => getStatus());
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!filterQuery.trim()) return CATEGORIES;
    const q = filterQuery.toLowerCase();
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [filterQuery]);

  const content = (
    <>
      {loading && !status ? (
        <div className={styles.settingsSkeleton}>
          <Skeleton variant="block" count={3} />
        </div>
      ) : !status ? (
        <ErrorBanner message={statusError || 'Failed to load status.'} onRetry={loadStatus} />
      ) : (
        <>
          {(!filterQuery.trim()
            ? activeCategory === 'general'
            : filteredCategories.some((c) => c.id === 'general')) && (
            <SettingsGeneral
              session={session}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onOpenShortcuts={onOpenShortcuts}
              onLogout={onLogout}
              onSessionChange={onSessionChange}
            />
          )}

          {(!filterQuery.trim()
            ? activeCategory === 'server'
            : filteredCategories.some((c) => c.id === 'server')) && (
            <SettingsServer status={status} />
          )}

          {(!filterQuery.trim()
            ? activeCategory === 'storage'
            : filteredCategories.some((c) => c.id === 'storage')) && (
            <SettingsStorage roots={status.roots} />
          )}

          {(!filterQuery.trim()
            ? activeCategory === 'desktop'
            : filteredCategories.some((c) => c.id === 'desktop')) && (
            <SettingsDesktop
              services={services}
              serviceHealth={serviceHealth}
              onAddService={onAddService}
              onEditService={onEditService}
              onRemoveService={onRemoveService}
              onReorderServices={onReorderServices}
            />
          )}

          {(!filterQuery.trim()
            ? activeCategory === 'admin'
            : filteredCategories.some((c) => c.id === 'admin')) && (
            <SettingsAdmin
              status={status}
              session={session}
              onOpenShares={onOpenShares}
            />
          )}

          {(!filterQuery.trim()
            ? activeCategory === 'about'
            : filteredCategories.some((c) => c.id === 'about')) && (
            <SettingsAbout status={status} />
          )}

          {filterQuery.trim() && filteredCategories.length === 0 && (
            <div className={styles.settingsSection}>
              <EmptyState
                compact
                title="No matching settings"
                subtitle={`Nothing found for "${filterQuery}"`}
              />
            </div>
          )}
        </>
      )}
    </>
  );

  const sidebarNav = (
    <nav className={styles.settingsNav} aria-label="Settings categories">
      <input
        type="text"
        className={styles.settingsFilter}
        placeholder="Search settings..."
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
      />
      <ul className={styles.settingsNavList}>
        {(filterQuery.trim() ? filteredCategories : CATEGORIES).map((cat) => (
          <li key={cat.id}>
            <button
              className={`${styles.settingsNavItem}${activeCategory === cat.id ? ` ${styles.active}` : ''}`}
              onClick={() => {
                setActiveCategory(cat.id);
                setFilterQuery('');
              }}
              aria-current={activeCategory === cat.id ? 'true' : undefined}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <AppPanel layout="split" sidebar={sidebarNav}>
      {content}
    </AppPanel>
  );
}
