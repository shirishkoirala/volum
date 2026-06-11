import { useCallback, useRef } from 'react';
import { useWindowManager, type WindowState } from '../../contexts/WindowManager';
import { useIsMobile } from '../../hooks/useIsMobile';
import styles from './WindowFrame.module.css';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// Height of shell chrome that maximized windows stay between
const TOPBAR_H = 44;
const TASKBAR_H = 56;

export function WindowFrame({ win, children }: { win: WindowState; children?: React.ReactNode }) {
  const { focusWindow, closeWindow, toggleMinimize, toggleMaximize, updatePosition, updateSize } = useWindowManager();
  const prevRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const isMobile = useIsMobile();

  const zIndex = win.zIndex;
  const isMaximized = win.maximized;
  const isMinimized = win.minimized;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile || isMaximized) return;
    e.preventDefault();
    focusWindow(win.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = win.x;
    const startTop = win.y;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newX = Math.max(-win.width + 80, Math.min(window.innerWidth - 80, startLeft + dx));
      const newY = Math.max(-win.height + 80, Math.min(window.innerHeight - TASKBAR_H - 40, startTop + dy));
      updatePosition(win.id, newX, newY);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [focusWindow, win.id, win.x, win.y, win.width, win.height, isMobile, isMaximized, updatePosition]);

  const handleResizeStart = useCallback((dir: ResizeDir, e: React.MouseEvent) => {
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

      if (dir.includes('e')) w = Math.max(300, startW + dx);
      if (dir.includes('w')) { w = Math.max(300, startW - dx); x = startL + startW - w; }
      if (dir.includes('s')) h = Math.max(200, startH + dy);
      if (dir.includes('n')) { h = Math.max(200, startH - dy); y = startT + startH - h; }

      updatePosition(win.id, x, y);
      updateSize(win.id, w, h);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [focusWindow, win.id, win.width, win.height, win.x, win.y, isMobile, isMaximized, updatePosition, updateSize]);

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
  }, [isMaximized, toggleMaximize, win.id, win.x, win.y, win.width, win.height, updatePosition, updateSize, isMobile]);

  const handleMaximizeClick = useCallback(() => {
    if (isMobile) return;
    if (!isMaximized) {
      prevRectRef.current = { x: win.x, y: win.y, width: win.width, height: win.height };
    } else if (prevRectRef.current) {
      updatePosition(win.id, prevRectRef.current.x, prevRectRef.current.y);
      updateSize(win.id, prevRectRef.current.width, prevRectRef.current.height);
    }
    toggleMaximize(win.id);
  }, [isMaximized, toggleMaximize, win.id, win.x, win.y, win.width, win.height, updatePosition, updateSize, isMobile]);

  // Maximized windows stack below shell chrome (z-index ~30-50)
  const displayZIndex = isMaximized ? Math.min(zIndex, 20) : zIndex;

  const style: React.CSSProperties = isMaximized ? {
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
  } : {
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
      <div className={styles.windowFrame} style={style} onMouseDown={() => focusWindow(win.id)}>
      <div className={styles.titleBar} onMouseDown={handleMouseDown} onDoubleClick={handleTitleDoubleClick}>
        <span className={styles.titleText}>{win.title}</span>
        <div className={styles.controls}>
          {!isMobile && <>
            <button className={styles.controlBtn} onClick={(e) => { e.stopPropagation(); toggleMinimize(win.id); }} aria-label="Minimize">─</button>
            <button className={styles.controlBtn} onClick={(e) => { e.stopPropagation(); handleMaximizeClick(); }} aria-label={isMaximized ? 'Restore' : 'Maximize'}>{isMaximized ? '❐' : '□'}</button>
          </>}
          <button className={`${styles.controlBtn} ${styles.closeBtn}`} onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }} aria-label="Close">✕</button>
        </div>
      </div>
      <div className={styles.content}>
        {children}
      </div>
      {!isMaximized && !isMobile && <>
        {resizeHandle('n')}
        {resizeHandle('s')}
        {resizeHandle('e')}
        {resizeHandle('w')}
        {resizeHandle('ne')}
        {resizeHandle('nw')}
        {resizeHandle('se')}
        {resizeHandle('sw')}
      </>}
    </div>
  );
}
