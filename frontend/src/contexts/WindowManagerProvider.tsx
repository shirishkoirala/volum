import { useCallback, useRef, useState } from 'react';
import { WindowManagerContext, type WindowState } from './WindowManager';
import { STANDARD_WINDOW_W, STANDARD_WINDOW_H } from '../utils/window';

let nextZIndex = 100;
const MAX_Z_INDEX = 9990;
const WINDOW_OFFSET = 24;

function nextZ(): number {
  const z = nextZIndex;
  if (nextZIndex < MAX_Z_INDEX) nextZIndex++;
  return z;
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const windowsRef = useRef(windows);
  windowsRef.current = windows;
  const windowCounts = useRef<Record<string, number>>({});
  const cascadeIndex = useRef(0);

  // Reset cascadeIndex when all windows close
  const prevLenRef = useRef(0);
  if (windows.length === 0 && prevLenRef.current > 0) {
    cascadeIndex.current = 0;
  }
  prevLenRef.current = windows.length;

  const openWindow = useCallback((opts: {
    id: string; title: string; icon: string; winType: string; params: Record<string, unknown>;
    x?: number; y?: number; width?: number; height?: number;
  }) => {
    setWindows((prev) => {
      if (prev.some((w) => w.id === opts.id)) {
        const z = nextZ();
        return prev.map((w) => w.id === opts.id ? { ...w, minimized: false, zIndex: z } : w);
      }
      const z = nextZ();
      return [...prev, {
        id: opts.id,
        title: opts.title,
        icon: opts.icon,
        winType: opts.winType,
        params: opts.params,
        x: opts.x ?? 100,
        y: opts.y ?? 80,
        width: opts.width ?? STANDARD_WINDOW_W,
        height: opts.height ?? STANDARD_WINDOW_H,
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
    const z = nextZ();
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, minimized: false, zIndex: z } : w));
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

  const toggleWindow = useCallback((windowType: string, opts: {
    title: string; icon: string; winType: string; params: Record<string, unknown>;
    x?: number; y?: number; width?: number; height?: number;
  }): string => {
    const currentWindows = windowsRef.current;
    const existing = currentWindows.find((w) => w.id.startsWith(`${windowType}-`));
    if (existing) {
      const z = nextZ();
      setWindows((prev) => prev.map((w) => w.id === existing.id ? {
        ...w,
        title: opts.title,
        icon: opts.icon,
        winType: opts.winType,
        params: opts.params,
        width: opts.width ?? STANDARD_WINDOW_W,
        height: opts.height ?? STANDARD_WINDOW_H,
        minimized: false,
        zIndex: z,
      } : w));
      return existing.id;
    }
    const count = (windowCounts.current[windowType] ?? 0) + 1;
    windowCounts.current[windowType] = count;
    const id = `${windowType}-${count}`;
    const ci = cascadeIndex.current;
    cascadeIndex.current = ci + 1;
    const x = 60 + (ci % 6) * WINDOW_OFFSET;
    const y = 40 + (ci % 6) * WINDOW_OFFSET;
    const z = nextZ();
    setWindows((prev) => [...prev, {
      id,
      title: opts.title,
      icon: opts.icon,
      winType: opts.winType,
      params: opts.params,
      x: opts.x ?? x,
      y: opts.y ?? y,
      width: opts.width ?? STANDARD_WINDOW_W,
      height: opts.height ?? STANDARD_WINDOW_H,
      minimized: false,
      maximized: false,
      zIndex: z,
    }]);
    return id;
  }, []);

  return (
    <WindowManagerContext.Provider value={{
      windows, openWindow, closeWindow, focusWindow,
      toggleMinimize, toggleMaximize, updatePosition, updateSize, toggleWindow,
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
}
