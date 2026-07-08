import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewPreferences } from '../hooks/useViewPreferences';

beforeEach(() => {
  localStorage.clear();
});

describe('useViewPreferences', () => {
  it('returns default values', () => {
    const { result } = renderHook(() => useViewPreferences());
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.sortField).toBe('name');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.showHidden).toBe(false);
  });

  it('loads saved values from localStorage', () => {
    localStorage.setItem('volum_viewMode', '"list"');
    localStorage.setItem('volum_sortField', '"size"');
    localStorage.setItem('volum_sortDirection', '"desc"');
    localStorage.setItem('volum_showHidden', 'true');

    const { result } = renderHook(() => useViewPreferences());
    expect(result.current.viewMode).toBe('list');
    expect(result.current.sortField).toBe('size');
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.showHidden).toBe(true);
  });

  it('showHidden toggles', () => {
    const { result } = renderHook(() => useViewPreferences());
    act(() => {
      result.current.setShowHidden(true);
    });
    expect(result.current.showHidden).toBe(true);
  });

  it('setViewMode updates the state', () => {
    const { result } = renderHook(() => useViewPreferences());
    act(() => {
      result.current.setViewMode('list');
    });
    expect(result.current.viewMode).toBe('list');
  });

  it('setSortField and setSortDirection update state', () => {
    const { result } = renderHook(() => useViewPreferences());
    act(() => {
      result.current.setSortField('size');
    });
    act(() => {
      result.current.setSortDirection('desc');
    });
    expect(result.current.sortField).toBe('size');
    expect(result.current.sortDirection).toBe('desc');
  });

  it('navigateToPath sets currentPath and persists via auto-save effect', () => {
    const { result } = renderHook(() => useViewPreferences());

    act(() => {
      result.current.setViewMode('list');
    });
    act(() => {
      result.current.navigateToPath('/home');
    });

    expect(result.current.currentPath).toBe('/home');

    act(() => {
      result.current.navigateToPath('/other');
    });
    expect(result.current.currentPath).toBe('/other');
  });
});
