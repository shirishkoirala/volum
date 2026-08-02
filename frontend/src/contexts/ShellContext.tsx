import { createContext, useContext } from 'react';

export interface ShellContextType {
  showToastObj: (toast: {
    title: string;
    message?: string;
    variant: 'success' | 'error' | 'warning';
    action?: { label: string; onClick: () => void };
  }) => void;
  navigateTo: (path: string) => void;
}

export const ShellContext = createContext<ShellContextType>({
  showToastObj: () => {},
  navigateTo: () => {},
});

export function useShellContext() {
  return useContext(ShellContext);
}
