import { afterEach, describe, expect, it } from 'vitest';
import { TOPBAR_H, TASKBAR_H, clampWindowRect, getWorkArea } from '../utils/window';

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
});

describe('window bounds', () => {
  it('fits an oversized window inside the available work area', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    expect(clampWindowRect({ x: 100, y: 80, width: 860, height: 580 })).toEqual({
      x: 0,
      y: TOPBAR_H,
      width: 800,
      height: 600 - TOPBAR_H - TASKBAR_H,
    });
  });

  it('moves an existing window back into view', () => {
    const area = { x: 0, y: TOPBAR_H, width: 1000, height: 700 };

    expect(clampWindowRect({ x: 900, y: 700, width: 500, height: 400 }, area)).toEqual({
      x: 500,
      y: 344,
      width: 500,
      height: 400,
    });
  });

  it('does not invent work area below the shell chrome', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 80 });
    expect(getWorkArea().height).toBe(0);
  });
});
