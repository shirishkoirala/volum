export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type SnapTarget =
  'maximize' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const TOPBAR_H = 44;
export const TASKBAR_H = 56;
export const SNAP_THRESHOLD = 24;
export const MIN_EDGE_DISTANCE = 80;
export const MIN_WINDOW_W = 300;
export const MIN_WINDOW_H = 200;
export const STANDARD_WINDOW_W = 860;
export const STANDARD_WINDOW_H = 580;

export function getCenteredWindowPos(width: number, height: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const workH = h - TOPBAR_H - TASKBAR_H;
  return {
    x: Math.round((w - width) / 2),
    y: Math.round(TOPBAR_H + (workH - height) * 0.25),
  };
}

export function getStandardWindowPos() {
  return getCenteredWindowPos(STANDARD_WINDOW_W, STANDARD_WINDOW_H);
}

export function getWorkArea() {
  return {
    x: 0,
    y: TOPBAR_H,
    width: window.innerWidth,
    height: Math.max(MIN_WINDOW_H, window.innerHeight - TOPBAR_H - TASKBAR_H),
  };
}

export function getSnapTarget(clientX: number, clientY: number): SnapTarget | null {
  const area = getWorkArea();
  const nearLeft = clientX <= SNAP_THRESHOLD;
  const nearRight = clientX >= area.width - SNAP_THRESHOLD;
  const nearTop = clientY <= area.y + SNAP_THRESHOLD;
  const nearBottom = clientY >= area.y + area.height - SNAP_THRESHOLD;

  if (nearLeft && nearTop) return 'topLeft';
  if (nearRight && nearTop) return 'topRight';
  if (nearLeft && nearBottom) return 'bottomLeft';
  if (nearRight && nearBottom) return 'bottomRight';
  if (nearTop) return 'maximize';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  return null;
}

export function getSnapRect(target: SnapTarget): WindowRect {
  const area = getWorkArea();
  const halfW = Math.round(area.width / 2);
  const halfH = Math.round(area.height / 2);

  switch (target) {
    case 'maximize':
      return area;
    case 'left':
      return { x: area.x, y: area.y, width: halfW, height: area.height };
    case 'right':
      return { x: halfW, y: area.y, width: area.width - halfW, height: area.height };
    case 'topLeft':
      return { x: area.x, y: area.y, width: halfW, height: halfH };
    case 'topRight':
      return { x: halfW, y: area.y, width: area.width - halfW, height: halfH };
    case 'bottomLeft':
      return { x: area.x, y: area.y + halfH, width: halfW, height: area.height - halfH };
    case 'bottomRight':
      return {
        x: halfW,
        y: area.y + halfH,
        width: area.width - halfW,
        height: area.height - halfH,
      };
  }
}
