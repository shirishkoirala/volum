import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRubberBand } from '../hooks/useRubberBand';
import { createRef } from 'react';

describe('useRubberBand', () => {
  it('returns rubberBandStyle as null initially', () => {
    const setSelectedPaths = vi.fn();
    const setLastSelectedPath = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const { result } = renderHook(() =>
      useRubberBand([], setSelectedPaths, setLastSelectedPath, ref),
    );

    expect(result.current.rubberBandStyle).toBeNull();
    expect(result.current.handleFileAreaMouseDown).toBeInstanceOf(Function);
  });

  it('handleFileAreaMouseDown adds mouse event listeners', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const setSelectedPaths = vi.fn();
    const setLastSelectedPath = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const { result } = renderHook(() =>
      useRubberBand([], setSelectedPaths, setLastSelectedPath, ref),
    );

    const el = document.createElement('div');
    const mouseEvent = {
      target: el,
      currentTarget: el,
      button: 0,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      clientX: 100,
      clientY: 200,
    };

    result.current.handleFileAreaMouseDown(mouseEvent as unknown as React.MouseEvent<HTMLElement>);

    expect(addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(setSelectedPaths).toHaveBeenCalledWith([]);
    expect(setLastSelectedPath).toHaveBeenCalledWith(null);
  });

  it('does not start rubber band when clicking on a child element', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const setSelectedPaths = vi.fn();
    const setLastSelectedPath = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const { result } = renderHook(() =>
      useRubberBand([], setSelectedPaths, setLastSelectedPath, ref),
    );

    const child = document.createElement('div');
    const parent = document.createElement('div');
    const mouseEvent = {
      target: child,
      currentTarget: parent,
      button: 0,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      clientX: 100,
      clientY: 200,
    };

    result.current.handleFileAreaMouseDown(mouseEvent as unknown as React.MouseEvent<HTMLElement>);

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('does not start rubber band when right-click button !== 0', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const setSelectedPaths = vi.fn();
    const setLastSelectedPath = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const { result } = renderHook(() =>
      useRubberBand([], setSelectedPaths, setLastSelectedPath, ref),
    );

    const mouseEvent = {
      target: null,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      button: 2,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      clientX: 100,
      clientY: 200,
    };

    result.current.handleFileAreaMouseDown(mouseEvent as unknown as React.MouseEvent<HTMLElement>);

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('does not start rubber band when shift, meta, or ctrl is pressed', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const setSelectedPaths = vi.fn();
    const setLastSelectedPath = vi.fn();
    const ref = createRef<HTMLDivElement>();

    const { result } = renderHook(() =>
      useRubberBand([], setSelectedPaths, setLastSelectedPath, ref),
    );

    const mouseEvent = {
      target: null,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      button: 0,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      clientX: 100,
      clientY: 200,
    };

    result.current.handleFileAreaMouseDown(mouseEvent as unknown as React.MouseEvent<HTMLElement>);

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
