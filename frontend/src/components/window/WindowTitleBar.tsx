import { Icon } from '../ui/Icon';
import styles from './WindowTitleBar.module.css';

type WindowTitleBarProps = {
  title: string;
  isMaximized: boolean;
  isMobile: boolean;
  onMinimize: () => void;
  onMaximizeClick: () => void;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
};

export function WindowTitleBar({
  title,
  isMaximized,
  isMobile,
  onMinimize,
  onMaximizeClick,
  onClose,
  onMouseDown,
  onDoubleClick,
}: WindowTitleBarProps) {
  return (
    <div
      className={`${styles.titleBar} appSurfaceHeader`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <span className={styles.titleText}>{title}</span>
      <div className={styles.controls}>
        {!isMobile && (
          <>
            <button
              className={`${styles.controlBtn} appSurfaceControl`}
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              aria-label="Minimize"
            >
              <Icon name="window-minimize" size={14} />
            </button>
            <button
              className={`${styles.controlBtn} appSurfaceControl`}
              onClick={(e) => {
                e.stopPropagation();
                onMaximizeClick();
              }}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Icon name={isMaximized ? 'window-restore' : 'window-maximize'} size={14} />
            </button>
          </>
        )}
        <button
          className={`${styles.controlBtn} ${styles.closeBtn} appSurfaceControl`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
        >
          <Icon name="window-close" size={14} />
        </button>
      </div>
    </div>
  );
}
