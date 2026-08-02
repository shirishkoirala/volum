import type { RootEntry } from '../api/client-files';

export function defaultRootPath(roots: RootEntry[]): string {
  return (
    roots.find((root) => root.isHome && root.available)?.path ??
    roots.find((root) => root.available)?.path ??
    roots.find((root) => root.isHome)?.path ??
    roots[0]?.path ??
    '/'
  );
}
