import { describe, expect, it } from 'vitest';
import { defaultRootPath } from '../utils/roots';
import { buildRootEntry } from './fixtures';

describe('defaultRootPath', () => {
  it('prefers the available home root', () => {
    expect(
      defaultRootPath([buildRootEntry({ path: '/storage' }), buildRootEntry({ path: '/home/shirish', isHome: true })]),
    ).toBe('/home/shirish');
  });

  it('falls back to the first available root when no home root is set', () => {
    expect(
      defaultRootPath([buildRootEntry({ path: '/storage', available: false }), buildRootEntry({ path: '/mnt/media' })]),
    ).toBe('/mnt/media');
  });

  it('falls back to the home root when it is unavailable', () => {
    expect(
      defaultRootPath([
        buildRootEntry({ path: '/storage', available: false }),
        buildRootEntry({ path: '/home/shirish', available: false, isHome: true }),
      ]),
    ).toBe('/home/shirish');
  });

  it('falls back to / when no roots exist', () => {
    expect(defaultRootPath([])).toBe('/');
  });
});
