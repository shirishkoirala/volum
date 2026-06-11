import { createContext, useContext } from 'react';

export type WindowState = {
  id: string;
  title: string;
  icon: string;
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
    icon: string;
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
  toggleWindow: (type: string, opts: {
    title: string;
    icon: string;
    view: React.ReactNode;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => string;
};

export const WindowManagerContext = createContext<WindowManagerType>({
  windows: [],
  openWindow: () => undefined,
  closeWindow: () => undefined,
  focusWindow: () => undefined,
  toggleMinimize: () => undefined,
  toggleMaximize: () => undefined,
  updatePosition: () => undefined,
  updateSize: () => undefined,
  toggleWindow: () => '',
});

export function useWindowManager() {
  return useContext(WindowManagerContext);
}
