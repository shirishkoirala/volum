const TOPBAR_H = 44;
const TASKBAR_H = 56;

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
