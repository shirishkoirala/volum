import { useWindowManager } from '../../contexts/WindowManager';
import { WindowFrame } from './WindowFrame';

export function WindowHost() {
  const { windows } = useWindowManager();
  if (windows.length === 0) return null;
  return (
    <>
      {windows.map((win) => (
        <WindowFrame key={win.id} win={win} />
      ))}
    </>
  );
}
