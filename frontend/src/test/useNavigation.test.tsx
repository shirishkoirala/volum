import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNavigation, type ActiveView } from '../hooks/useNavigation';

describe('useNavigation', () => {
  it('keeps only the most recently opened workspace view active', () => {
    const { result } = renderHook(() => useNavigation([], [], 0, ''));
    const views: ActiveView[] = [
      'trash',
      'settings',
      'jobs',
      'drives',
      'search',
      'storage-analyzer',
    ];

    for (const view of views) {
      act(() => result.current.setActiveView(view));
      expect(result.current.activeView).toBe(view);
    }
  });
});
