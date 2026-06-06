import { Children, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { IconButton, RotatedIcon } from '../ui/shared';
import styles from './BreadcrumbBar.module.css';

export type Crumb = {
  label: string;
  path?: string;
};

type BreadcrumbBarProps = {
  crumbs: Crumb[];
  onBack: () => void;
  onGoUp?: () => void;
  onNavigate: (path: string) => void;
  onLocationNavigate?: (path: string) => void;
  locationMode?: boolean;
  onToggleLocationMode?: () => void;
  children?: ReactNode;
};

export function BreadcrumbBar({ crumbs, onBack, onGoUp, onNavigate, onLocationNavigate, locationMode, onToggleLocationMode, children }: BreadcrumbBarProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const rightOverflowRef = useRef<HTMLDivElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const [showOverflow, setShowOverflow] = useState(false);
  const [toolbarOverflowIdx, setToolbarOverflowIdx] = useState(-1);
  const [showToolbarOverflow, setShowToolbarOverflow] = useState(false);
  const [locationValue, setLocationValue] = useState('');

  const childrenArray = useMemo(() => Children.toArray(children), [children]);
  const hasToolbar = childrenArray.length > 0 && !locationMode;
  const headerClassName = `${styles.header}${hasToolbar ? ` ${styles.withToolbar}` : ''}`;

  useEffect(() => {
    if (locationMode && locationInputRef.current) {
      setLocationValue(crumbs.map((c) => c.path || c.label).filter(Boolean).join('/') || '/');
      locationInputRef.current.focus();
      locationInputRef.current.select();
    }
  }, [crumbs, locationMode]);

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

  useEffect(() => {
    if (!showToolbarOverflow) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setShowToolbarOverflow(false);
        return;
      }
      if (rightOverflowRef.current && !rightOverflowRef.current.contains(e.target as Node)) {
        setShowToolbarOverflow(false);
      }
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [showToolbarOverflow]);

  // Measure toolbar items using a hidden measure container
  useEffect(() => {
    const rightEl = rightRef.current;
    const measureEl = measureRef.current;
    if (!rightEl || !measureEl) return;

    const check = () => {
      const available = rightEl.clientWidth;
      const measureItems = Array.from(measureEl.children) as HTMLElement[];
      if (measureItems.length === 0) return;

      let total = 0;
      let overflowIdx = -1;
      const moreBtnW = 34;

      for (let i = 0; i < measureItems.length; i++) {
        const w = measureItems[i]!.offsetWidth;
        const needsMore = i < measureItems.length - 1;
        if (total + w + (needsMore ? moreBtnW : 0) > available && i > 0) {
          overflowIdx = i;
          break;
        }
        total += w;
      }
      setToolbarOverflowIdx(overflowIdx);
    };

    // Flush layout before first measure
    requestAnimationFrame(check);
    const ro = new ResizeObserver(check);
    ro.observe(rightEl);
    return () => ro.disconnect();
  }, [childrenArray]);

  const visibleToolbarItems = toolbarOverflowIdx > 0
    ? childrenArray.slice(0, toolbarOverflowIdx)
    : childrenArray;

  const hiddenToolbarItems = toolbarOverflowIdx > 0
    ? childrenArray.slice(toolbarOverflowIdx)
    : [];

  const overflowCrumbs = overflowCount > 0
    ? crumbs.slice(1, -overflowCount - 1 > 0 ? -overflowCount : undefined)
    : [];

  const visibleCrumbs = overflowCount > 0
    ? [crumbs[0]!, crumbs[crumbs.length - 1]!]
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
      <header className={headerClassName}>
        <div className={styles.left}>
          <IconButton onClick={onToggleLocationMode} title="Cancel">
            <Icon name="window-close" size={18} />
          </IconButton>
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
    <header className={headerClassName}>
      <div className={styles.left}>
        <IconButton
          onClick={onBack}
          title="Go back"
        >
          <RotatedIcon><Icon name="go-next" size={18} /></RotatedIcon>
        </IconButton>
        {onGoUp && (
          <IconButton onClick={onGoUp} title="Go up">
            <Icon name="go-up" size={18} />
          </IconButton>
        )}
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
                  if (!overflowCrumb) return null;
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
      {hasToolbar && (
        <div className={styles.right} ref={rightRef}>
          {visibleToolbarItems}
          {toolbarOverflowIdx > 0 && (
            <div className={styles.moreWrap}>
              <button
                type="button"
                className={styles.moreBtn}
                onClick={() => setShowToolbarOverflow(!showToolbarOverflow)}
                title="More actions"
              >
                <Icon name="view-more" size={18} />
              </button>
              {showToolbarOverflow && (
                <div ref={rightOverflowRef} className={styles.moreMenu}>
                  {hiddenToolbarItems}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Hidden measure container — always has all items for accurate sizing */}
      <div ref={measureRef} className={styles.measureContainer} aria-hidden="true">
        {childrenArray}
      </div>
      {onToggleLocationMode && (
        <button className={styles.locationToggle} onClick={onToggleLocationMode} title="Enter path (Ctrl+L)" type="button">
          <Icon name="go-jump" size={16} />
        </button>
      )}
    </header>
  );
}
