/**
 * Shared archive-related helpers — extension detection and name derivation.
 */

/**
 * Returns true when the filename has a recognised archive extension.
 */
export function isArchiveFile(name: string): boolean {
  return /\.(zip|tar|tar\.gz|tgz)$/i.test(name);
}

/**
 * Strip archive extensions to derive a base name.
 * "foo.tar.gz" → "foo" / "archive.zip" → "archive"
 */
export function archiveBaseName(name: string): string {
  return name
    .replace(/\.tar\.gz$/i, '')
    .replace(/\.tgz$/i, '')
    .replace(/\.tar$/i, '')
    .replace(/\.zip$/i, '') || 'archive';
}

/**
 * Derive a ".zip" file name from an existing archive name.
 * "foo.tar → foo.zip" /  "bar.7z → "bar.zip"
 */
export function archiveFileName(name: string): string {
  return `${archiveBaseName(name)}.zip`;
}
