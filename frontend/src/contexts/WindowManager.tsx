import { createContext, useContext } from 'react';

export type WindowState = {
  id: string;
  title: string;
  view: React.ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
};

export type WindowManagerType = {
  windows: WindowState[];
  openWindow: (opts: {
    id: string;
    title: string;
    view: React.ReactNode;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  updateSize: (id: string, width: number, height: number) => void;
};

export const WindowManagerContext = createContext<WindowManagerType>({
  windows: [],
  openWindow: () => {},
  closeWindow: () => {},
  focusWindow: () => {},
  toggleMinimize: () => {},
  toggleMaximize: () => {},
  updatePosition: () => {},
  updateSize: () => {},
});

export function useWindowManager() {
  return useContext(WindowManagerContext);
}
