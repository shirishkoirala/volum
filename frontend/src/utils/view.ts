/**
 * View-mode utility shared by every view that supports cycling.
 */

/** The three file/folder display modes used across the app. */
export type ViewMode = 'list' | 'grid' | 'columns';

/**
 * Cycle to the next view mode in order: list → grid → columns → list
 */
export function cycleViewMode(current: ViewMode): ViewMode {
  return current === 'list' ? 'grid' : current === 'grid' ? 'columns' : 'list';
}
