import { createContext, useContext } from 'react';

export interface ShellContextType {
  showToast: (title: string, variant?: 'success' | 'error' | 'warning', message?: string) => void;
  showToastObj: (toast: {
    title: string;
    message?: string;
    variant: 'success' | 'error' | 'warning';
    action?: { label: string; onClick: () => void };
  }) => void;
  navigateTo: (path: string) => void;
  refresh: () => void;
}

export const ShellContext = createContext<ShellContextType>({
  showToast: () => {},
  showToastObj: () => {},
  navigateTo: () => {},
  refresh: () => {},
});

export function useShellContext() {
  return useContext(ShellContext);
}
