import { useEffect } from 'react';

export function useClickOutsideMenus(closeMenus: () => void) {
  useEffect(() => {
    document.addEventListener('click', closeMenus);
    window.addEventListener('resize', closeMenus);
    return () => {
      document.removeEventListener('click', closeMenus);
      window.removeEventListener('resize', closeMenus);
    };
  }, [closeMenus]);
}
