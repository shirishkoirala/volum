import { useEffect, useCallback } from 'react';

export function useClickOutsideMenus(menuStates: Record<string, boolean>, setMenuStates: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void) {
  const handleClick = useCallback(() => {
    setMenuStates((prev) => {
      const anyOpen = Object.values(prev).some(Boolean);
      if (!anyOpen) return prev;
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) next[key] = false;
      return next;
    });
  }, [setMenuStates]);

  const handleResize = useCallback(() => {
    setMenuStates((prev) => {
      const anyOpen = Object.values(prev).some(Boolean);
      if (!anyOpen) return prev;
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) next[key] = false;
      return next;
    });
  }, [setMenuStates]);

  useEffect(() => {
    document.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleClick, handleResize]);
}
