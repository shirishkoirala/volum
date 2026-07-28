import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClickOutsideMenus } from '../hooks/useClickOutsideMenus';

describe('useClickOutsideMenus', () => {
  it('closes menus on document click', () => {
    const closeMenus = vi.fn();
    renderHook(() => useClickOutsideMenus(closeMenus));
    document.dispatchEvent(new MouseEvent('click'));

    expect(closeMenus).toHaveBeenCalledOnce();
  });

  it('closes menus on window resize', () => {
    const closeMenus = vi.fn();
    renderHook(() => useClickOutsideMenus(closeMenus));
    window.dispatchEvent(new Event('resize'));

    expect(closeMenus).toHaveBeenCalledOnce();
  });
});
