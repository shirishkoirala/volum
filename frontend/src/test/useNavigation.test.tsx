import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WindowManagerType } from '../contexts/WindowManager';
import { useNavigation } from '../hooks/useNavigation';
import { useNavStack } from '../hooks/useNavStack';
import { useWorkspaceOpeners } from '../hooks/useWorkspaceOpeners';

const noop = () => undefined;
const windowManager: WindowManagerType = {
  windows: [],
  openWindow: noop,
  closeWindow: noop,
  focusWindow: noop,
  toggleMinimize: noop,
  toggleMaximize: noop,
  updatePosition: noop,
  updateSize: noop,
  toggleWindow: () => '',
};

describe('useNavigation', () => {
  it('routes mobile workspace openers through the active view and navigation stack', () => {
    const { result } = renderHook(() => {
      const [currentPath, setCurrentPath] = useState('');
      const nav = useNavigation([], 0, currentPath);
      const navActions = useNavStack({
        viewPref: { currentPath, setCurrentPath, navigateToPath: setCurrentPath },
        nav,
        browser: {
          refresh: noop,
          setSearchOpen: noop,
          setSearchResults: noop,
          setQuery: noop,
          setTrashEntries: noop,
        },
      });
      const openers = useWorkspaceOpeners({
        defaultRootPath: '/storage',
        isMobile: true,
        nav,
        navActions,
        setPreviewEntry: noop,
        setPreviewEntries: noop,
        trashCount: 0,
        wm: windowManager,
      });

      return { activeView: nav.activeView, currentPath, ...openers };
    });

    const transitions = [
      ['openTrash', 'trash'],
      ['openSettings', 'settings'],
      ['openJobs', 'jobs'],
      ['openDrives', 'drives'],
      ['openStorageAnalyzer', 'storage-analyzer'],
    ] as const;

    for (const [open, view] of transitions) {
      act(() => result.current[open]());
      expect(result.current.activeView).toBe(view);
    }

    act(() => result.current.openFiles('/storage/photos'));
    expect(result.current.activeView).toBe('files');
    expect(result.current.currentPath).toBe('/storage/photos');

    act(() => result.current.openDesktop());
    expect(result.current.activeView).toBe('desktop');
    expect(result.current.currentPath).toBe('');
  });
});
