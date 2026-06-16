import type { ServiceHealthInfo, ServiceInfo } from '../api/client';

export type ServiceShortcut = Omit<ServiceInfo, 'position' | 'iconUrl' | 'healthUrl'> & {
  iconUrl?: string;
  healthUrl?: string;
};

export type ServiceHealthResult = ServiceHealthInfo;

export type ServiceHealthStatus = 'healthy' | 'unhealthy';

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
