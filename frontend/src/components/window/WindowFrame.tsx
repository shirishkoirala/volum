import { useCallback, useRef, useState } from 'react';
import { useWindowManager, type WindowState } from '../../contexts/WindowManager';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Icon } from '../ui/Icon';
import styles from './WindowFrame.module.css';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type SnapTarget =
  'maximize' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Height of shell chrome that maximized windows stay between
const TOPBAR_H = 44;
const TASKBAR_H = 56;
const SNAP_THRESHOLD = 24;
const MIN_EDGE_DISTANCE = 80;
const MIN_WINDOW_W = 300;
const MIN_WINDOW_H = 200;

function getWorkArea() {
  return {
    x: 0,
    y: TOPBAR_H,
    width: window.innerWidth,
    height: Math.max(MIN_WINDOW_H, window.innerHeight - TOPBAR_H - TASKBAR_H),
  };
}

function getSnapTarget(clientX: number, clientY: number): SnapTarget | null {
  const area = getWorkArea();
  const nearLeft = clientX <= SNAP_THRESHOLD;
  const nearRight = clientX >= area.width - SNAP_THRESHOLD;
  const nearTop = clientY <= area.y + SNAP_THRESHOLD;
  const nearBottom = clientY >= area.y + area.height - SNAP_THRESHOLD;

  if (nearLeft && nearTop) return 'topLeft';
  if (nearRight && nearTop) return 'topRight';
  if (nearLeft && nearBottom) return 'bottomLeft';
  if (nearRight && nearBottom) return 'bottomRight';
  if (nearTop) return 'maximize';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  return null;
}

function getSnapRect(target: SnapTarget): WindowRect {
  const area = getWorkArea();
  const halfW = Math.round(area.width / 2);
  const halfH = Math.round(area.height / 2);

  switch (target) {
    case 'maximize':
      return area;
    case 'left':
      return { x: area.x, y: area.y, width: halfW, height: area.height };
    case 'right':
      return { x: halfW, y: area.y, width: area.width - halfW, height: area.height };
    case 'topLeft':
      return { x: area.x, y: area.y, width: halfW, height: halfH };
    case 'topRight':
      return { x: halfW, y: area.y, width: area.width - halfW, height: halfH };
    case 'bottomLeft':
      return { x: area.x, y: area.y + halfH, width: halfW, height: area.height - halfH };
    case 'bottomRight':
      return {
        x: halfW,
        y: area.y + halfH,
        width: area.width - halfW,
        height: area.height - halfH,
      };
  }
}

export function WindowFrame({ win, children }: { win: WindowState; children?: React.ReactNode }) {
  const { focusWindow, closeWindow, toggleMinimize, toggleMaximize, updatePosition, updateSize } =
    useWindowManager();
  const prevRectRef = useRef<WindowRect | null>(null);
  const [snapPreview, setSnapPreview] = useState<WindowRect | null>(null);
  const isMobile = useIsMobile();

  const zIndex = win.zIndex;
  const isMaximized = win.maximized;
  const isMinimized = win.minimized;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile || isMaximized) return;
      e.preventDefault();
      focusWindow(win.id);
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = win.x;
      const startTop = win.y;
      const startRect = { x: win.x, y: win.y, width: win.width, height: win.height };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newX = Math.max(
          -win.width + MIN_EDGE_DISTANCE,
          Math.min(window.innerWidth - MIN_EDGE_DISTANCE, startLeft + dx),
        );
        const newY = Math.max(
          -win.height + 80,
          Math.min(window.innerHeight - TASKBAR_H - 40, startTop + dy),
        );
        const target = getSnapTarget(ev.clientX, ev.clientY);
        setSnapPreview(target ? getSnapRect(target) : null);
        updatePosition(win.id, newX, newY);
      };
      const handleMouseUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        setSnapPreview(null);

        const target = getSnapTarget(ev.clientX, ev.clientY);
        if (!target) return;

        if (target === 'maximize') {
          prevRectRef.current = startRect;
          toggleMaximize(win.id);
          return;
        }

        const rect = getSnapRect(target);
        updatePosition(win.id, rect.x, rect.y);
        updateSize(win.id, rect.width, rect.height);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [
      focusWindow,
      win.id,
      win.x,
      win.y,
      win.width,
      win.height,
      isMobile,
      isMaximized,
      updatePosition,
      updateSize,
      toggleMaximize,
    ],
  );

  const handleResizeStart = useCallback(
    (dir: ResizeDir, e: React.MouseEvent) => {
      if (isMobile || isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win.id);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = win.width;
      const startH = win.height;
      const startL = win.x;
      const startT = win.y;

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let x = startL;
        let y = startT;
        let w = startW;
        let h = startH;

        if (dir.includes('e')) w = Math.max(MIN_WINDOW_W, startW + dx);
        if (dir.includes('w')) {
          w = Math.max(MIN_WINDOW_W, startW - dx);
          x = startL + startW - w;
        }
        if (dir.includes('s')) h = Math.max(MIN_WINDOW_H, startH + dy);
        if (dir.includes('n')) {
          h = Math.max(MIN_WINDOW_H, startH - dy);
          y = startT + startH - h;
        }

        updatePosition(win.id, x, y);
        updateSize(win.id, w, h);
      };
      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [
      focusWindow,
      win.id,
      win.width,
      win.height,
      win.x,
      win.y,
      isMobile,
      isMaximized,
      updatePosition,
      updateSize,
    ],
  );

  const handleTitleDoubleClick = useCallback(() => {
    if (isMobile) return;
    if (isMaximized) {
      if (prevRectRef.current) {
        updatePosition(win.id, prevRectRef.current.x, prevRectRef.current.y);
        updateSize(win.id, prevRectRef.current.width, prevRectRef.current.height);
      }
      toggleMaximize(win.id);
    } else {
      prevRectRef.current = { x: win.x, y: win.y, width: win.width, height: win.height };
      toggleMaximize(win.id);
    }
  }, [
    isMaximized,
    toggleMaximize,
    win.id,
    win.x,
    win.y,
    win.width,
    win.height,
    updatePosition,
    updateSize,
    isMobile,
  ]);

  const handleMaximizeClick = useCallback(() => {
    if (isMobile) return;
    if (!isMaximized) {
      prevRectRef.current = { x: win.x, y: win.y, width: win.width, height: win.height };
    } else if (prevRectRef.current) {
      updatePosition(win.id, prevRectRef.current.x, prevRectRef.current.y);
      updateSize(win.id, prevRectRef.current.width, prevRectRef.current.height);
    }
    toggleMaximize(win.id);
  }, [
    isMaximized,
    toggleMaximize,
    win.id,
    win.x,
    win.y,
    win.width,
    win.height,
    updatePosition,
    updateSize,
    isMobile,
  ]);

  // Maximized windows stack below shell chrome (z-index ~30-50)
  const displayZIndex = isMaximized ? Math.min(zIndex, 20) : zIndex;

  const style: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        top: TOPBAR_H,
        left: 0,
        right: 0,
        bottom: TASKBAR_H,
        zIndex: displayZIndex,
        display: isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
        border: 'none',
        borderRadius: 0,
      }
    : {
        position: 'fixed',
        top: win.y,
        left: win.x,
        width: win.width,
        height: win.height,
        zIndex: displayZIndex,
        display: isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
      };

  const resizeHandle = (dir: ResizeDir) => (
    <div
      className={`${styles.resizeHandle} ${styles[`handle${dir.toUpperCase()}` as keyof typeof styles] || ''}`}
      onMouseDown={(e) => handleResizeStart(dir, e)}
    />
  );

  return (
    <>
      {snapPreview && (
        <div
          className={styles.snapPreview}
          style={{
            left: snapPreview.x,
            top: snapPreview.y,
            width: snapPreview.width,
            height: snapPreview.height,
          }}
          aria-hidden="true"
        />
      )}
      <div
        className={`${styles.windowFrame} appSurface`}
        style={style}
        onMouseDown={() => focusWindow(win.id)}
      >
        <div
          className={`${styles.titleBar} appSurfaceHeader`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleTitleDoubleClick}
        >
          <span className={styles.titleText}>{win.title}</span>
          <div className={styles.controls}>
            {!isMobile && (
              <>
                <button
                  className={`${styles.controlBtn} appSurfaceControl`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMinimize(win.id);
                  }}
                  aria-label="Minimize"
                >
                  <Icon name="window-minimize" size={14} />
                </button>
                <button
                  className={`${styles.controlBtn} appSurfaceControl`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMaximizeClick();
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
                closeWindow(win.id);
              }}
              aria-label="Close"
            >
              <Icon name="window-close" size={14} />
            </button>
          </div>
        </div>
        <div className={`${styles.content} appSurfaceBody`}>{children}</div>
        {!isMaximized && !isMobile && (
          <>
            {resizeHandle('n')}
            {resizeHandle('s')}
            {resizeHandle('e')}
            {resizeHandle('w')}
            {resizeHandle('ne')}
            {resizeHandle('nw')}
            {resizeHandle('se')}
            {resizeHandle('sw')}
          </>
        )}
      </div>
    </>
  );
}
