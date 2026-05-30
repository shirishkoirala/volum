/**
 * Shared path-manipulation utilities used across the app.
 */

/**
 * Strip trailing slashes, ensuring a single leading slash remains.
 */
export function normalizeFolderPath(path: string): string {
  return path.replace(/\/+$/, '') || '/';
}

/**
 * Join a parent path and child name, deduplicating double slashes.
 */
export function joinPath(parent: string, name: string): string {
  return `${normalizeFolderPath(parent).replace(/\/$/, '')}/${name}`.replace(/^\/\//, '/');
}

/**
 * De-duplicate and normalize a list of folder paths.
 */
export function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    const normalized = normalizeFolderPath(path.trim());
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}


