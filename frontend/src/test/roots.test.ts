import { describe, expect, it } from 'vitest';
import type { RootEntry } from '../api/client';
import { defaultRootPath } from '../utils/roots';

function root(path: string, options: Partial<RootEntry> = {}): RootEntry {
  return {
    path,
    discovered: false,
    available: true,
    totalBytes: 0,
    freeBytes: 0,
    usedBytes: 0,
    isHome: false,
    ...options,
  };
}

describe('defaultRootPath', () => {
  it('prefers the available home root', () => {
    expect(defaultRootPath([
      root('/storage'),
      root('/home/shirish', { isHome: true }),
    ])).toBe('/home/shirish');
  });

  it('falls back to the first available root when no home root is set', () => {
    expect(defaultRootPath([
      root('/storage', { available: false }),
      root('/mnt/media'),
    ])).toBe('/mnt/media');
  });

  it('falls back to the home root when it is unavailable', () => {
    expect(defaultRootPath([
      root('/storage', { available: false }),
      root('/home/shirish', { available: false, isHome: true }),
    ])).toBe('/home/shirish');
  });

  it('falls back to / when no roots exist', () => {
    expect(defaultRootPath([])).toBe('/');
  });
});
