import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './BreadcrumbBar.module.css';

export type Crumb = {
  label: string;
  path?: string;
};

type BreadcrumbBarProps = {
  crumbs: Crumb[];
  onBack: () => void;
  onNavigate: (path: string) => void;
  onLocationNavigate?: (path: string) => void;
  locationMode?: boolean;
  onToggleLocationMode?: () => void;
  children?: ReactNode;
};

export function BreadcrumbBar({ crumbs, onBack, onNavigate, onLocationNavigate, locationMode, onToggleLocationMode, children }: BreadcrumbBarProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const [showOverflow, setShowOverflow] = useState(false);
  const [locationValue, setLocationValue] = useState('');

  useEffect(() => {
    if (locationMode && locationInputRef.current) {
      setLocationValue(crumbs.map((c) => c.path || c.label).filter(Boolean).join('/') || '/');
      locationInputRef.current.focus();
      locationInputRef.current.select();
    }
  }, [locationMode]);

  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setShowOverflow(false);
        return;
      }
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [showOverflow]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => {
      const available = el.clientWidth;
      let totalWidth = 0;
      let count = 0;
      const children = Array.from(el.children);
      for (let i = 0; i < children.length; i++) {
        totalWidth += (children[i] as HTMLElement).offsetWidth || 0;
        if (totalWidth > available && i > 0) {
          count = children.length - i;
          break;
        }
      }
      setOverflowCount(count);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [crumbs]);

  const overflowCrumbs = overflowCount > 0
    ? crumbs.slice(1, -overflowCount - 1 > 0 ? -overflowCount : undefined)
    : [];

  const visibleCrumbs = overflowCount > 0
    ? [crumbs[0], crumbs[crumbs.length - 1]]
    : crumbs;

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onLocationNavigate?.(locationValue);
      onToggleLocationMode?.();
    } else if (e.key === 'Escape') {
      onToggleLocationMode?.();
    }
  };

  if (crumbs.length === 0) {
    return null;
  }

  if (locationMode) {
    return (
      <header className={styles.header}>
        <div className={styles.left}>
          <button className="icon-button" onClick={onToggleLocationMode} title="Cancel" type="button">
            <Icon name="window-close" size={18} />
          </button>
          <div className={styles.locationInputWrap}>
            <input
              ref={locationInputRef}
              type="text"
              className={styles.locationInput}
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              placeholder="Enter path..."
              spellCheck={false}
            />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className="icon-button"
          onClick={onBack}
          title="Go back"
          type="button"
        >
          <span className="icon-rotate-180"><Icon name="go-next" size={18} /></span>
        </button>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <div ref={navRef} className={styles.breadcrumbsInner}>
            {visibleCrumbs.map((crumb, rawIndex) => {
              const index = overflowCount > 0 ? (rawIndex === 0 ? 0 : crumbs.length - 1) : rawIndex;
              const isLast = index === crumbs.length - 1;
              return (
                <span key={crumb.path ?? index} className={styles.crumbRow}>
                  {index > 0 && <Icon name="go-next" size={16} />}
                  {isLast ? (
                    <span className={styles.current}>{crumb.label}</span>
                  ) : crumb.path ? (
                    <button type="button" onClick={() => onNavigate(crumb.path!)} className={styles.crumbBtn}>
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={styles.current}>{crumb.label}</span>
                  )}
                </span>
              );
            })}
            {overflowCount > 1 && (
              <span className={styles.crumbRow}>
                <Icon name="go-next" size={16} />
                <span className={styles.overflowDots} onClick={() => setShowOverflow(!showOverflow)}>
                  <span className={styles.overflowBtn}>···</span>
                </span>
                {showOverflow && (
                  <div ref={overflowRef} className={styles.overflowMenu}>
                    {overflowCrumbs.map((crumb) => (
                      <button
                        key={crumb.path}
                        type="button"
                        className={styles.overflowItem}
                        onClick={() => { setShowOverflow(false); if (crumb.path) onNavigate(crumb.path); }}
                      >
                        {crumb.label}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            )}
            {overflowCount === 1 && (
              <span className={styles.crumbRow}>
                <Icon name="go-next" size={16} />
                {(() => {
                  const overflowCrumb = crumbs[crumbs.length - 2];
                  return (
                    <span className={styles.overflowDots} onClick={() => setShowOverflow(!showOverflow)}>
                      <span className={styles.overflowBtn}>···</span>
                      {showOverflow && (
                        <div ref={overflowRef} className={styles.overflowMenu}>
                          <button
                            type="button"
                            className={styles.overflowItem}
                            onClick={() => { setShowOverflow(false); if (overflowCrumb.path) onNavigate(overflowCrumb.path); }}
                          >
                            {overflowCrumb.label}
                          </button>
                        </div>
                      )}
                    </span>
                  );
                })()}
              </span>
            )}
          </div>
        </nav>
      </div>
      {children && <div className={styles.right}>{children}</div>}
      {onToggleLocationMode && (
        <button className={styles.locationToggle} onClick={onToggleLocationMode} title="Enter path (Ctrl+L)" type="button">
          <Icon name="edit-find" size={16} />
        </button>
      )}
    </header>
  );
}
