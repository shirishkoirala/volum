export type ServiceShortcut = {
  id: string;
  name: string;
  url: string;
  iconUrl?: string;
};

const STORAGE_KEY = 'volum_services';

let idCounter = Date.now();

export function nextServiceId(): string {
  return `svc_${++idCounter}`;
}

export function loadServices(): ServiceShortcut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ServiceShortcut[];
  } catch { /* ignore */ }
  return [];
}

export function saveServices(services: ServiceShortcut[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
  } catch (e) {
    console.warn('Failed to save service shortcuts:', e);
  }
}

export function validUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function tryLoadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

const FAVICON_CANDIDATES = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png'];

export async function detectFavicon(pageUrl: string): Promise<string | null> {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return null;
  }
  for (const path of FAVICON_CANDIDATES) {
    const candidate = origin + path;
    if (await tryLoadImage(candidate)) return candidate;
  }
  return null;
}
