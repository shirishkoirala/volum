import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validUrl, detectFavicon } from '../utils/services';

describe('validUrl', () => {
  it('returns true for http URLs', () => {
    expect(validUrl('http://example.com')).toBe(true);
    expect(validUrl('http://example.com/path')).toBe(true);
  });

  it('returns true for https URLs', () => {
    expect(validUrl('https://example.com')).toBe(true);
    expect(validUrl('https://example.com:8080/path')).toBe(true);
  });

  it('returns false for ftp URLs', () => {
    expect(validUrl('ftp://example.com')).toBe(false);
  });

  it('returns false for invalid strings', () => {
    expect(validUrl('not-a-url')).toBe(false);
    expect(validUrl('')).toBe(false);
    expect(validUrl('http://')).toBe(false);
  });
});

describe('detectFavicon', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for invalid URL', async () => {
    const result = await detectFavicon('not-a-url');
    expect(result).toBeNull();
  });

  it('returns the first candidate that loads successfully', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(() => {
        const img = {
          onload: null as unknown as () => void,
          onerror: null as unknown as () => void,
          set src(_url: string) {
            callCount++;
            if (callCount === 1) {
              setTimeout(() => img.onerror?.(), 0);
            } else {
              setTimeout(() => img.onload?.(), 0);
            }
          },
        };
        return img;
      }),
    );

    const result = await detectFavicon('https://example.com');
    expect(result).toBe('https://example.com/favicon.png');
  });

  it('returns null when all candidates fail', async () => {
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(() => {
        const img = {
          onload: null as unknown as () => void,
          onerror: null as unknown as () => void,
          set src(_url: string) {
            setTimeout(() => img.onerror?.(), 0);
          },
        };
        return img;
      }),
    );

    const result = await detectFavicon('https://example.com');
    expect(result).toBeNull();
  });

  it('constructs correct candidate URLs from the page URL origin', async () => {
    const candidates: string[] = [];
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(() => {
        const img = {
          onload: null as unknown as () => void,
          onerror: null as unknown as () => void,
          set src(url: string) {
            candidates.push(url);
            setTimeout(() => img.onerror?.(), 0);
          },
        };
        return img;
      }),
    );

    await detectFavicon('https://example.com/some/page');
    expect(candidates).toEqual([
      'https://example.com/favicon.ico',
      'https://example.com/favicon.png',
      'https://example.com/apple-touch-icon.png',
    ]);
  });
});
