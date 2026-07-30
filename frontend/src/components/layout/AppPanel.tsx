import type { HTMLAttributes, ReactNode } from 'react';
import styles from './AppPanel.module.css';

type AppPanelElement = 'div' | 'main' | 'section';
type AppPanelPadding = 'none' | 'compact' | 'normal';

const paddingClasses: Record<AppPanelPadding, string | undefined> = {
  none: styles.paddingNone,
  compact: styles.paddingCompact,
  normal: styles.paddingNormal,
};

type AppPanelProps = {
  as?: AppPanelElement;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
  footer?: ReactNode;
  header?: ReactNode;
  onContextMenu?: HTMLAttributes<HTMLElement>['onContextMenu'];
  padding?: AppPanelPadding;
  scroll?: boolean;
  sidebar?: ReactNode;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AppPanel({
  as = 'section',
  bodyClassName,
  bodyProps,
  children,
  className,
  footer,
  header,
  onContextMenu,
  padding = 'normal',
  scroll = true,
  sidebar,
}: AppPanelProps) {
  const Element = as;
  const bodyClasses = joinClasses(
    styles.body,
    paddingClasses[padding],
    scroll ? styles.scroll : styles.static,
    bodyClassName,
    bodyProps?.className,
  );

  return (
    <Element
      className={joinClasses(styles.panel, 'glassPanel', className)}
      onContextMenu={onContextMenu}
    >
      {header ? <div className={styles.header}>{header}</div> : null}
      {sidebar ? (
        <div className={styles.splitContent}>
          <aside className={styles.sidebar}>{sidebar}</aside>
          <div {...bodyProps} className={bodyClasses}>
            {children}
          </div>
        </div>
      ) : (
        <div {...bodyProps} className={bodyClasses}>
          {children}
        </div>
      )}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </Element>
  );
}
