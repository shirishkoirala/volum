import type { HTMLAttributes, ReactNode } from 'react';
import styles from './AppPanel.module.css';

type AppPanelElement = 'div' | 'main' | 'section';
type AppPanelLayout = 'stack' | 'split';
type AppPanelPadding = 'none' | 'compact' | 'normal';

type AppPanelProps = {
  as?: AppPanelElement;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
  footer?: ReactNode;
  header?: ReactNode;
  layout?: AppPanelLayout;
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
  layout = 'stack',
  onContextMenu,
  padding = 'normal',
  scroll = true,
  sidebar,
}: AppPanelProps) {
  const Element = as;
  const bodyClasses = joinClasses(
    styles.body,
    styles[`padding-${padding}`],
    scroll ? styles.scroll : styles.static,
    bodyClassName,
    bodyProps?.className,
  );

  return (
    <Element
      className={joinClasses(styles.panel, styles[layout], 'glassPanel', 'mobileAppPanel', className)}
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
