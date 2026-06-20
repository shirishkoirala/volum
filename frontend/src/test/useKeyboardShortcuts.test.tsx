import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('calls the action for matching key', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts({ '?': action }));
    const event = new KeyboardEvent('keydown', { key: '?' });
    document.dispatchEvent(event);
    expect(action).toHaveBeenCalledOnce();
  });

  it('does not call action for non-matching key', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts({ '?': action }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores events from input elements', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts({ '?': action }));
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    input.dispatchEvent(event);
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores events from textarea elements', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts({ '?': action }));
    const textarea = document.createElement('textarea');
    const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    textarea.dispatchEvent(event);
    expect(action).not.toHaveBeenCalled();
  });
});
