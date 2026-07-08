import { MouseEvent, RefObject, useCallback, useRef, useState } from 'react';
import type { FileEntry } from '../api/client';

export function useRubberBand(
  filteredEntries: FileEntry[],
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>,
  setLastSelectedPath: React.Dispatch<React.SetStateAction<string | null>>,
  fileGridRef: RefObject<HTMLDivElement | null>,
) {
  const [rubberBandStyle, setRubberBandStyle] = useState<React.CSSProperties | null>(null);
  const rubberBandRef = useRef<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    active: boolean;
  }>({ startX: 0, startY: 0, endX: 0, endY: 0, active: false });
  const filteredRef = useRef(filteredEntries);
  filteredRef.current = filteredEntries;

  const handleFileAreaMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        event.target !== event.currentTarget ||
        event.button !== 0 ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const band = rubberBandRef.current;
      band.startX = event.clientX - rect.left;
      band.startY = event.clientY - rect.top;
      band.endX = band.startX;
      band.endY = band.startY;
      band.active = true;
      setRubberBandStyle({ left: band.startX, top: band.startY, width: 0, height: 0 });
      setSelectedPaths([]);
      setLastSelectedPath(null);

      const handleMouseMove = (e: globalThis.MouseEvent) => {
        if (!rubberBandRef.current.active) return;
        const rect2 = event.currentTarget.getBoundingClientRect();
        const endX = e.clientX - rect2.left;
        const endY = e.clientY - rect2.top;
        rubberBandRef.current.endX = endX;
        rubberBandRef.current.endY = endY;

        const left = Math.min(band.startX, endX);
        const top = Math.min(band.startY, endY);
        const width = Math.abs(endX - band.startX);
        const height = Math.abs(endY - band.startY);
        setRubberBandStyle({ left, top, width, height });

        const gridRects = fileGridRef.current?.querySelectorAll('[data-index]');
        if (!gridRects) return;
        const bandRect = { left, top, right: left + width, bottom: top + height };
        const selected: string[] = [];
        gridRects.forEach((el) => {
          const elRect = el.getBoundingClientRect();
          const elBandRect = {
            left: elRect.left - rect2.left,
            top: elRect.top - rect2.top,
            right: elRect.right - rect2.left,
            bottom: elRect.bottom - rect2.top,
          };
          if (
            elBandRect.left < bandRect.right &&
            elBandRect.right > bandRect.left &&
            elBandRect.top < bandRect.bottom &&
            elBandRect.bottom > bandRect.top
          ) {
            const idx = Number((el as HTMLElement).dataset.index);
            if (idx >= 0 && idx < filteredRef.current.length) {
              selected.push(filteredRef.current[idx]!.path);
            }
          }
        });
        setSelectedPaths(selected);
        if (selected.length > 0) {
          setLastSelectedPath(selected[selected.length - 1]!);
        }
      };

      const handleMouseUp = () => {
        rubberBandRef.current.active = false;
        setRubberBandStyle(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [fileGridRef, setSelectedPaths, setLastSelectedPath],
  );

  return { rubberBandStyle, handleFileAreaMouseDown };
}
