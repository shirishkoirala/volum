import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowManager, type WindowState } from '../../contexts/WindowManager';
import styles from './WindowFrame.module.css';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export function WindowFrame({ win, children }: { win: WindowState; children?: React.ReactNode }) {
  const { focusWindow, closeWindow, toggleMinimize, toggleMaximize, updatePosition, updateSize } = useWindowManager();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const resizeRef = useRef<{ dir: ResizeDir; startX: number; startY: number; startW: number; startH: number; startL: number; startT: number } | null>(null);
  const prevRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const isMobile = useIsMobile();

  const zIndex = win.zIndex;
  const isMaximized = win.maximized;
  const isMinimized = win.minimized;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    focusWindow(win.id);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: win.x,
      startTop: win.y,
    };
  }, [focusWindow, win.id, win.x, win.y, isMobile]);

  useEffect(() => {
    if (!dragRef.current) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (isMaximized) return;
      updatePosition(win.id, dragRef.current.startLeft + dx, dragRef.current.startTop + dy);
    };
    const handleMouseUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [win.id, isMaximized, updatePosition]);

  const handleResizeStart = useCallback((dir: ResizeDir, e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.id);
    resizeRef.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: win.width,
      startH: win.height,
      startL: win.x,
      startT: win.y,
    };
  }, [focusWindow, win.id, win.width, win.height, win.x, win.y, isMobile]);

  useEffect(() => {
    if (!resizeRef.current) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      let { x, y, w, h } = { x: r.startL, y: r.startT, w: r.startW, h: r.startH };

      if (r.dir.includes('e')) w = Math.max(300, r.startW + dx);
      if (r.dir.includes('w')) { w = Math.max(300, r.startW - dx); x = r.startL + dx; }
      if (r.dir.includes('s')) h = Math.max(200, r.startH + dy);
      if (r.dir.includes('n')) { h = Math.max(200, r.startH - dy); y = r.startT + dy; }

      updatePosition(win.id, x, y);
      updateSize(win.id, w, h);
    };
    const handleMouseUp = () => { resizeRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [win.id, updatePosition, updateSize]);

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

  const style: React.CSSProperties = isMaximized ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex,
    display: isMinimized ? 'none' : 'flex',
    flexDirection: 'column',
  } : {
    position: 'fixed',
    top: win.y,
    left: win.x,
    width: win.width,
    height: win.height,
    zIndex,
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
    <div ref={frameRef} className={styles.windowFrame} style={style} onMouseDown={() => focusWindow(win.id)}>
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
