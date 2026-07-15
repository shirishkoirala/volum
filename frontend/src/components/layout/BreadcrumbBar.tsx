import { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { IconButton, RotatedIcon } from '../ui/shared';
import { BreadcrumbNav } from './BreadcrumbNav';
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
  flush?: boolean;
  children?: ReactNode;
};

export function BreadcrumbBar({
  crumbs,
  onBack,
  onGoUp,
  onNavigate,
  onLocationNavigate,
  locationMode,
  onToggleLocationMode,
  flush = false,
  children,
}: BreadcrumbBarProps) {
  const rightRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const rightOverflowRef = useRef<HTMLDivElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [toolbarOverflowIdx, setToolbarOverflowIdx] = useState(-1);
  const [showToolbarOverflow, setShowToolbarOverflow] = useState(false);
  const [locationValue, setLocationValue] = useState('');

  const childrenArray = useMemo(() => Children.toArray(children), [children]);
  const hasToolbar = childrenArray.length > 0 && !locationMode;
  const headerClassName = `${styles.header}${hasToolbar ? ` ${styles.withToolbar}` : ''}${flush ? ` ${styles.flush}` : ''}`;

  useEffect(() => {
    if (locationMode && locationInputRef.current) {
      setLocationValue(
        crumbs
          .map((c) => c.path || c.label)
          .filter(Boolean)
          .join('/') || '/',
      );
      locationInputRef.current.focus();
      locationInputRef.current.select();
    }
  }, [crumbs, locationMode]);

  const closeToolbarOverflow = useCallback(() => setShowToolbarOverflow(false), []);

  useEffect(() => {
    if (!showToolbarOverflow) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') closeToolbarOverflow();
        return;
      }
      if (rightOverflowRef.current && !rightOverflowRef.current.contains(e.target as Node)) {
        closeToolbarOverflow();
      }
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [showToolbarOverflow, closeToolbarOverflow]);

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

    requestAnimationFrame(check);
    const ro = new ResizeObserver(check);
    ro.observe(rightEl);
    return () => ro.disconnect();
  }, [childrenArray]);

  const visibleToolbarItems =
    toolbarOverflowIdx > 0 ? childrenArray.slice(0, toolbarOverflowIdx) : childrenArray;

  const hiddenToolbarItems = toolbarOverflowIdx > 0 ? childrenArray.slice(toolbarOverflowIdx) : [];

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
        <IconButton onClick={onBack} title="Go back">
          <RotatedIcon>
            <Icon name="go-next" size={18} />
          </RotatedIcon>
        </IconButton>
        {onGoUp && (
          <IconButton onClick={onGoUp} title="Go up">
            <Icon name="go-up" size={18} />
          </IconButton>
        )}
        <BreadcrumbNav crumbs={crumbs} onNavigate={onNavigate} />
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
      <div ref={measureRef} className={styles.measureContainer} aria-hidden="true">
        {childrenArray}
      </div>
      {onToggleLocationMode && (
        <button
          className={styles.locationToggle}
          onClick={onToggleLocationMode}
          title="Enter path (Ctrl+L)"
          type="button"
        >
          <Icon name="go-jump" size={16} />
        </button>
      )}
    </header>
  );
}
