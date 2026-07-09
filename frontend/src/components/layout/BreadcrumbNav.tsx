import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { Crumb } from './BreadcrumbBar';
import styles from './BreadcrumbBar.module.css';

type BreadcrumbNavProps = {
  crumbs: Crumb[];
  onNavigate: (path: string) => void;
};

export function BreadcrumbNav({ crumbs, onNavigate }: BreadcrumbNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const [showOverflow, setShowOverflow] = useState(false);

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

  const overflowCrumbs =
    overflowCount > 0 ? crumbs.slice(1, -overflowCount - 1 > 0 ? -overflowCount : undefined) : [];

  const visibleCrumbs = overflowCount > 0 ? [crumbs[0]!, crumbs[crumbs.length - 1]!] : crumbs;

  return (
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
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.path!)}
                  className={styles.crumbBtn}
                >
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
            <span
              className={styles.overflowDots}
              onClick={() => setShowOverflow(!showOverflow)}
            >
              <span className={styles.overflowBtn}>···</span>
            </span>
            {showOverflow && (
              <div ref={overflowRef} className={styles.overflowMenu}>
                {overflowCrumbs.map((crumb) => (
                  <button
                    key={crumb.path}
                    type="button"
                    className={styles.overflowItem}
                    onClick={() => {
                      setShowOverflow(false);
                      if (crumb.path) onNavigate(crumb.path);
                    }}
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
                <span
                  className={styles.overflowDots}
                  onClick={() => setShowOverflow(!showOverflow)}
                >
                  <span className={styles.overflowBtn}>···</span>
                  {showOverflow && (
                    <div ref={overflowRef} className={styles.overflowMenu}>
                      <button
                        type="button"
                        className={styles.overflowItem}
                        onClick={() => {
                          setShowOverflow(false);
                          if (overflowCrumb.path) onNavigate(overflowCrumb.path);
                        }}
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
  );
}
