import { useWindowManager, type WindowState } from '../../contexts/WindowManager';
import { useIsMobile } from '../../hooks/useIsMobile';
import { WindowIdContext } from '../../contexts/WindowCommands';
import { WindowFrame } from './WindowFrame';

export function WindowHost({
  renderWindow,
}: {
  renderWindow: (win: WindowState) => React.ReactNode;
}) {
  const { windows } = useWindowManager();
  const isMobile = useIsMobile();

  if (isMobile || windows.length === 0) return null;

  return (
    <>
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win}>
          <WindowIdContext.Provider value={win.id}>{renderWindow(win)}</WindowIdContext.Provider>
        </WindowFrame>
      ))}
    </>
  );
}
