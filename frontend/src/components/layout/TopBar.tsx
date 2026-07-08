import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppMenuBar, type AppMenuHandlers } from './AppMenuBar';
import { TopBarSearch } from './TopBarSearch';
import { ActivityPanel } from './ActivityPanel';
import { Calendar } from '../overlay/Calendar';
import { ThemeToggle } from '../ui/ThemeToggle';
import { IconButton } from '../ui/shared';
import { Icon } from '../ui/Icon';
import { profileAvatarUrl, type Session, type SearchResult, type Job } from '../../api/client';
import { BRAND_ICON_URL } from '../../utils/brand';
import { countActiveTransfers } from '../../utils/jobs';
import styles from './TopBar.module.css';

type ActiveView = 'desktop' | 'files' | 'trash' | 'settings' | 'jobs' | 'drives' | 'search';

type TopBarProps = {
  activeView: ActiveView;
  onGoDesktop: () => void;
  onOpenSettings?: () => void;
  menuHandlers?: AppMenuHandlers;
  title?: string;
  session?: Session | null;
  onLogout?: () => void;
  focusedWindowType?: string | null;
  focusedWindowExists?: boolean;
  // Search
  searchQuery: string;
  searchOpen: boolean;
  searchResults: SearchResult[] | null;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSearchResultClick: (result: SearchResult) => void;
  onShowAllSearchResults: (query: string) => void;
  // Theme
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  // Activity
  jobs?: Job[];
  onOpenJobs?: () => void;
};

type TopBarAction = {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  onClick: () => void;
  kind?: 'theme' | 'activity';
};

function formatDateTime(date: Date) {
  const weekday = date.toLocaleDateString([], { weekday: 'short' });
  const dayMonth = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${dayMonth}, ${time}`;
}

export function TopBar({
  activeView,
  onGoDesktop,
  onOpenSettings,
  menuHandlers,
  title,
  session,
  onLogout,
  focusedWindowType,
  focusedWindowExists,
  searchQuery,
  searchOpen,
  searchResults,
  onSearch,
  onClearSearch,
  onSearchResultClick,
  onShowAllSearchResults,
  theme,
  onToggleTheme,
  jobs,
  onOpenJobs,
}: TopBarProps) {
  const [dateTime, setDateTime] = useState(() => formatDateTime(new Date()));
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(() => searchQuery.length > 0 || searchOpen);
  const [visibleActionCount, setVisibleActionCount] = useState(Number.MAX_SAFE_INTEGER);
  const topbarRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const iconClusterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setDateTime(formatDateTime(new Date()));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const closeOverlays = useCallback(() => {
    setUserMenuOpen(false);
    setActivityOpen(false);
    setOverflowOpen(false);
    setCalendarOpen(false);
  }, []);

  useEffect(() => {
    if (!userMenuOpen && !activityOpen && !overflowOpen && !calendarOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (activityOpen && activityRef.current && !activityRef.current.contains(e.target as Node)) {
        setActivityOpen(false);
      }
      if (overflowOpen && overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
      if (calendarOpen && calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen, activityOpen, overflowOpen, calendarOpen]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSearchExpanded(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showUserMenu = session?.authEnabled && session.authenticated;
  const showMenu = Boolean(
    ((focusedWindowExists && (focusedWindowType === 'files' || focusedWindowType === 'trash')) ||
      activeView === 'files' ||
      activeView === 'trash') &&
    menuHandlers,
  );
  const appMenuWindowType = !focusedWindowExists ? activeView : (focusedWindowType ?? activeView);
  const actions: TopBarAction[] = [];

  if (onOpenJobs && jobs) {
    actions.push({
      id: 'activity',
      label: 'Activity',
      kind: 'activity',
      onClick: () => setActivityOpen((v) => !v),
    });
  }
  actions.push({
    id: 'theme',
    label: theme === 'light' ? 'Dark mode' : 'Light mode',
    kind: 'theme',
    onClick: onToggleTheme,
  });

  useEffect(() => {
    if (searchQuery.length > 0 || searchOpen) setSearchExpanded(true);
  }, [searchQuery, searchOpen]);

  useLayoutEffect(() => {
    const topbar = topbarRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    const cluster = iconClusterRef.current;
    if (!topbar || !left || !right || !cluster) return;

    const updateVisibleActions = () => {
      const fixedRightWidth = right.offsetWidth - cluster.offsetWidth;
      const availableWidth = Math.max(
        0,
        topbar.clientWidth - left.scrollWidth - fixedRightWidth - 24,
      );
      const actionWidth = 34;
      const allActionsWidth = actions.length * actionWidth;
      const nextCount =
        allActionsWidth <= availableWidth
          ? actions.length
          : Math.max(
              0,
              Math.min(
                actions.length - 1,
                Math.floor((availableWidth - actionWidth) / actionWidth),
              ),
            );
      setVisibleActionCount((current) => (current === nextCount ? current : nextCount));
    };

    updateVisibleActions();
    const observer = new ResizeObserver(updateVisibleActions);
    observer.observe(topbar);
    observer.observe(left);
    observer.observe(right);
    return () => observer.disconnect();
  }, [actions.length, searchExpanded, showMenu]);

  const visibleActions = actions.slice(0, visibleActionCount);
  const overflowActions = actions.slice(visibleActionCount);

  return (
    <header className={styles.topbar} ref={topbarRef}>
      <div className={styles.left} ref={leftRef}>
        <button
          className={styles.brand}
          onClick={onGoDesktop}
          type="button"
          title="Go to desktop"
          aria-label="Go to desktop"
        >
          <img className={styles.brandIcon} src={BRAND_ICON_URL} alt="" />
          <span className={styles.brandName}>{title ?? 'Volum Desktop'}</span>
        </button>
        {showMenu && (
          <div className={styles.menuCluster}>
            <AppMenuBar handlers={menuHandlers!} windowType={appMenuWindowType} />
          </div>
        )}
      </div>

      <div className={styles.right} ref={rightRef}>
        <TopBarSearch
          expanded={searchExpanded}
          query={searchQuery}
          searchOpen={searchOpen}
          searchResults={searchResults}
          onSearch={onSearch}
          onClearSearch={onClearSearch}
          onSearchResultClick={onSearchResultClick}
          onShowAllResults={onShowAllSearchResults}
          onExpand={() => {
            setSearchExpanded(true);
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
          onCollapse={() => setSearchExpanded(false)}
          searchRef={searchRef}
        />
        <div className={styles.iconCluster} ref={iconClusterRef}>
          {visibleActions.map((action) => {
            if (action.kind === 'theme') {
              return (
                <ThemeToggle
                  key={action.id}
                  theme={theme}
                  onClick={action.onClick}
                  className={styles.toolbarIconButton}
                />
              );
            }
            if (action.kind === 'activity' && jobs && onOpenJobs) {
              return (
                <div key={action.id} className={styles.activityArea} ref={activityRef}>
                  <IconButton
                    className={styles.toolbarIconButton}
                    onClick={action.onClick}
                    title={action.label}
                    aria-label={action.label}
                    aria-expanded={activityOpen}
                  >
                    <Icon name="activity" size={16} />
                    {countActiveTransfers(jobs) > 0 && (
                      <span className={styles.activityBadge}>{countActiveTransfers(jobs)}</span>
                    )}
                  </IconButton>
                  {activityOpen && (
                    <ActivityPanel
                      jobs={jobs}
                      onOpenJobs={() => {
                        closeOverlays();
                        onOpenJobs();
                      }}
                    />
                  )}
                </div>
              );
            }
            return (
              <IconButton
                key={action.id}
                className={styles.toolbarIconButton}
                onClick={action.onClick}
                title={action.label}
                aria-label={action.label}
                disabled={action.disabled}
              >
                <Icon name={action.icon ?? 'view-more'} size={16} />
              </IconButton>
            );
          })}
          {overflowActions.length > 0 && (
            <div className={styles.overflowArea} ref={overflowRef}>
              <button
                type="button"
                className={styles.overflowButton}
                title="More actions"
                aria-label="More actions"
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen((v) => !v)}
              >
                <Icon name="view-more" size={16} />
              </button>
              {overflowOpen && (
                <div className={styles.overflowMenu} role="menu">
                  {overflowActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={styles.overflowItem}
                      onClick={() => {
                        setOverflowOpen(false);
                        if (action.kind === 'activity' && onOpenJobs) {
                          onOpenJobs();
                        } else {
                          action.onClick();
                        }
                      }}
                      disabled={action.disabled}
                      role="menuitem"
                    >
                      {action.kind === 'theme' ? (
                        <Icon
                          name={theme === 'light' ? 'weather-clear-night' : 'weather-clear'}
                          size={16}
                        />
                      ) : action.kind === 'activity' ? (
                        <Icon name="activity" size={16} />
                      ) : (
                        <Icon name={action.icon ?? 'view-more'} size={16} />
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {showUserMenu && (
          <div className={styles.userArea} ref={menuRef}>
            <button
              className={styles.userButton}
              onClick={() => setUserMenuOpen((v) => !v)}
              type="button"
              aria-label={`User menu for ${session.username}`}
              aria-expanded={userMenuOpen}
            >
              {session.hasAvatar ? (
                <img
                  className={styles.userAvatar}
                  src={profileAvatarUrl(session.avatarVersion)}
                  alt=""
                />
              ) : (
                <Icon name="avatar-default" size={16} />
              )}
            </button>
            {userMenuOpen && (
              <div className={styles.userDropdown} role="menu">
                <div className={styles.dropdownHeader}>
                  {session.hasAvatar ? (
                    <img
                      className={styles.dropdownAvatar}
                      src={profileAvatarUrl(session.avatarVersion)}
                      alt=""
                    />
                  ) : (
                    <span className={styles.dropdownAvatarFallback}>
                      <Icon name="avatar-default" size={18} />
                    </span>
                  )}
                  <div className={styles.dropdownIdentity}>
                    <span className={styles.dropdownUsername}>{session.username}</span>
                    {session.role && <span className={styles.dropdownRole}>{session.role}</span>}
                  </div>
                </div>
                <div className={styles.dropdownDivider} />
                {onOpenSettings && (
                  <button
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenSettings();
                    }}
                    role="menuitem"
                  >
                    <Icon name="preferences-system" size={16} /> Settings
                  </button>
                )}
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout?.();
                  }}
                  role="menuitem"
                >
                  <Icon name="system-log-out" size={16} /> Log Out
                </button>
              </div>
            )}
          </div>
        )}
        <div className={styles.calendarArea} ref={calendarRef}>
          <button
            type="button"
            className={styles.clock}
            onClick={() => setCalendarOpen((v) => !v)}
            aria-label="Toggle calendar"
            aria-expanded={calendarOpen}
          >
            {dateTime}
          </button>
          {calendarOpen && <Calendar />}
        </div>
      </div>
    </header>
  );
}
