import { useEffect, useState } from 'react';
import { useWindowManager, type WindowState } from '../../contexts/WindowManager';
import { WindowFrame } from './WindowFrame';

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

export function WindowHost({ renderWindow }: { renderWindow: (win: WindowState) => React.ReactNode }) {
  const { windows } = useWindowManager();
  const isMobile = useIsMobile();

  if (isMobile || windows.length === 0) return null;

  return (
    <>
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win}>
          {renderWindow(win)}
        </WindowFrame>
      ))}
    </>
  );
}
