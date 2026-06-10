import { describe, it, expect } from 'vitest';
import { normalizeFolderPath, joinPath, uniquePaths } from '../utils/path';

describe('normalizeFolderPath', () => {
  it('returns / for empty input', () => {
    expect(normalizeFolderPath('')).toBe('/');
  });

  it('returns / for just slashes', () => {
    expect(normalizeFolderPath('///')).toBe('/');
  });

  it('strips trailing slashes', () => {
    expect(normalizeFolderPath('/foo/bar/')).toBe('/foo/bar');
  });

  it('preserves single leading slash', () => {
    expect(normalizeFolderPath('/foo')).toBe('/foo');
  });

  it('does not add a leading slash that was missing', () => {
    expect(normalizeFolderPath('foo/bar')).toBe('foo/bar');
  });
});

describe('joinPath', () => {
  it('joins parent and child', () => {
    expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
  });

  it('deduplicates slash when parent ends with /', () => {
    expect(joinPath('/foo/', 'bar')).toBe('/foo/bar');
  });

  it('handles root parent', () => {
    expect(joinPath('/', 'bar')).toBe('/bar');
  });

  it('handles nested paths', () => {
    expect(joinPath('/foo/bar', 'baz/file.txt')).toBe('/foo/bar/baz/file.txt');
  });
});

describe('uniquePaths', () => {
  it('deduplicates paths', () => {
    expect(uniquePaths(['/foo', '/foo', '/bar'])).toEqual(['/foo', '/bar']);
  });

  it('normalizes and deduplicates', () => {
    expect(uniquePaths(['/foo/', '/foo', '/bar'])).toEqual(['/foo', '/bar']);
  });

  it('normalizes empty/whitespace strings to /', () => {
    expect(uniquePaths(['', '/foo', '  '])).toEqual(['/', '/foo']);
  });

  it('returns empty array for empty input', () => {
    expect(uniquePaths([])).toEqual([]);
  });

  it('preserves order of first occurrence', () => {
    expect(uniquePaths(['/b', '/a', '/c', '/a'])).toEqual(['/b', '/a', '/c']);
  });
});
