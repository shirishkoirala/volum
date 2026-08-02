import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api/client-base';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('accepts successful responses with no JSON body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request<void>('/api/empty')).resolves.toBeUndefined();
    await expect(request<void>('/api/also-empty')).resolves.toBeUndefined();
  });
});
