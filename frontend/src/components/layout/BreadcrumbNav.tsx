import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { Crumb } from './BreadcrumbBar';
import styles from './BreadcrumbBar.module.css';

type BreadcrumbNavProps = {
  crumbs: Crumb[];
  onNavigate: (path: string) => void;
};

export function BreadcrumbNav({ crumbs, onNavigate }: BreadcrumbNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLSpanElement>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const overflowMenuId = useId();
  const [overflowCount, setOverflowCount] = useState(0);
  const [showOverflow, setShowOverflow] = useState(false);

  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') {
          setShowOverflow(false);
          overflowTriggerRef.current?.focus();
        }
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
    if (!showOverflow) return;
    overflowMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
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

  const overflowCrumbs = overflowCount > 0 ? crumbs.slice(1, -1) : [];

  const handleOverflowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      overflowMenuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length > 0) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + direction + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  };

  const renderCrumb = (crumb: Crumb, index: number) => {
    const isLast = index === crumbs.length - 1;
    return (
      <span key={crumb.path ?? index} className={styles.crumbRow}>
        {index > 0 && <Icon name="go-next" size={16} />}
        {isLast ? (
          <span className={styles.current} aria-current="page">
            {crumb.label}
          </span>
        ) : crumb.path ? (
          <button type="button" onClick={() => onNavigate(crumb.path!)} className={styles.crumbBtn}>
            {crumb.label}
          </button>
        ) : (
          <span className={styles.current}>{crumb.label}</span>
        )}
      </span>
    );
  };

  const overflowRow =
    overflowCount > 0 && overflowCrumbs.length > 0 ? (
      <span key="overflow" ref={overflowRef} className={styles.crumbRow}>
        <Icon name="go-next" size={16} />
        <span className={styles.overflowDots}>
          <button
            ref={overflowTriggerRef}
            type="button"
            className={styles.overflowBtn}
            aria-label="Show hidden breadcrumb folders"
            aria-haspopup="menu"
            aria-expanded={showOverflow}
            aria-controls={overflowMenuId}
            onClick={() => setShowOverflow((visible) => !visible)}
          >
            ···
          </button>
        </span>
        {showOverflow && (
          <div
            ref={overflowMenuRef}
            id={overflowMenuId}
            className={styles.overflowMenu}
            role="menu"
            aria-label="Hidden breadcrumb folders"
            onKeyDown={handleOverflowKeyDown}
          >
            {overflowCrumbs.map((crumb) => (
              <button
                key={crumb.path}
                type="button"
                className={styles.overflowItem}
                role="menuitem"
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
    ) : null;

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <div ref={navRef} className={styles.breadcrumbsInner}>
        {overflowCount > 0 ? (
          <>
            {renderCrumb(crumbs[0]!, 0)}
            {overflowRow}
            {renderCrumb(crumbs[crumbs.length - 1]!, crumbs.length - 1)}
          </>
        ) : (
          crumbs.map(renderCrumb)
        )}
      </div>
    </nav>
  );
}
