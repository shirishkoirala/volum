import { useCallback, useRef, useState } from 'react';
import { WindowManagerContext, type WindowState } from './WindowManager';

let nextZIndex = 100;

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const viewCache = useRef<Map<string, React.ReactNode>>(new Map());

  const openWindow = useCallback((opts: {
    id: string; title: string; view: React.ReactNode;
    x?: number; y?: number; width?: number; height?: number;
  }) => {
    viewCache.current.set(opts.id, opts.view);
    setWindows((prev) => {
      if (prev.some((w) => w.id === opts.id)) return prev;
      const z = nextZIndex++;
      return [...prev, {
        id: opts.id,
        title: opts.title,
        view: opts.view,
        x: opts.x ?? 100,
        y: opts.y ?? 80,
        width: opts.width ?? 800,
        height: opts.height ?? 500,
        minimized: false,
        maximized: false,
        zIndex: z,
      }];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    const z = nextZIndex++;
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, zIndex: z } : w));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, minimized: !w.minimized } : w));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, maximized: !w.maximized } : w));
  }, []);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, x, y } : w));
  }, []);

  const updateSize = useCallback((id: string, width: number, height: number) => {
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, width, height } : w));
  }, []);

  return (
    <WindowManagerContext.Provider value={{
      windows, openWindow, closeWindow, focusWindow,
      toggleMinimize, toggleMaximize, updatePosition, updateSize,
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
}
