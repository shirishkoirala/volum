import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

let originalConsoleError: typeof console.error;

beforeEach(() => {
  originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const hasActWarning = args.some(
      (arg) => typeof arg === 'string' && arg.includes('not wrapped in act'),
    );
    if (hasActWarning) {
      throw new Error(`React state update escaped act(): ${args.join(' ')}`);
    }
    originalConsoleError(...args);
  };
});

afterEach(() => {
  try {
    cleanup();
  } finally {
    console.error = originalConsoleError;
    vi.clearAllMocks();
  }
});

if (typeof globalThis.ResizeObserver === 'undefined') {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  });
}
