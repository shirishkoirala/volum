export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_PUBLIC_PATH ?? '';
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalized}${path}`;
}

export function assetUrl(path: string): string {
  const base = import.meta.env.VITE_PUBLIC_PATH ?? '';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}${path}`;
}
