import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClickOutsideMenus } from '../hooks/useClickOutsideMenus';

describe('useClickOutsideMenus', () => {
  it('closes all menus on document click', () => {
    const setter = vi.fn();
    setter.mockImplementation((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      return updater({ menu1: true, menu2: false });
    });
    renderHook(() => useClickOutsideMenus({ menu1: true, menu2: false }, setter));
    const event = new MouseEvent('click');
    document.dispatchEvent(event);
    expect(setter).toHaveBeenCalled();
    const updater = setter.mock.calls[0]![0] as (prev: Record<string, boolean>) => Record<string, boolean>;
    const result = updater({ menu1: true, menu2: false });
    expect(result).toEqual({ menu1: false, menu2: false });
  });

  it('returns same state when no menus are open', () => {
    const state: Record<string, boolean> = { menu1: false, menu2: false };
    const setter = vi.fn((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      Object.assign(state, updater(state));
    });
    renderHook(() => useClickOutsideMenus({ menu1: false, menu2: false }, setter));
    document.dispatchEvent(new MouseEvent('click'));
    expect(setter).toHaveBeenCalledOnce();
    expect(state).toEqual({ menu1: false, menu2: false });
  });

  it('closes menus on window resize', () => {
    const setter = vi.fn();
    setter.mockImplementation((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      return updater({ menu1: true });
    });
    renderHook(() => useClickOutsideMenus({ menu1: true }, setter));
    window.dispatchEvent(new Event('resize'));
    expect(setter).toHaveBeenCalled();
  });
});
