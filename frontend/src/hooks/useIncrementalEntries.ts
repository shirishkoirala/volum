import { UIEvent, useCallback, useEffect, useMemo, useState } from 'react';

const LARGE_FOLDER_THRESHOLD = 600;
const INITIAL_VISIBLE_COUNT = 240;
const VISIBLE_COUNT_BATCH = 240;
const LOAD_MORE_DISTANCE_PX = 720;

export function useIncrementalEntries<T>(entries: T[]) {
  const incremental = entries.length > LARGE_FOLDER_THRESHOLD;
  const [visibleCount, setVisibleCount] = useState(() => (incremental ? INITIAL_VISIBLE_COUNT : entries.length));

  useEffect(() => {
    setVisibleCount(entries.length > LARGE_FOLDER_THRESHOLD ? INITIAL_VISIBLE_COUNT : entries.length);
  }, [entries]);

  useEffect(() => {
    if (!incremental) setVisibleCount(entries.length);
  }, [entries.length, incremental]);

  const loadMore = useCallback(() => {
    if (!incremental) return;
    setVisibleCount((count) => Math.min(entries.length, count + VISIBLE_COUNT_BATCH));
  }, [entries.length, incremental]);

  const handleScroll = useCallback((event: UIEvent<HTMLElement>) => {
    if (!incremental) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < LOAD_MORE_DISTANCE_PX) loadMore();
  }, [incremental, loadMore]);

  const renderedCount = incremental ? Math.min(visibleCount, entries.length) : entries.length;
  const visibleEntries = useMemo(() => entries.slice(0, renderedCount), [entries, renderedCount]);

  return {
    incremental,
    totalCount: entries.length,
    renderedCount,
    hasMore: renderedCount < entries.length,
    visibleEntries,
    loadMore,
    handleScroll,
  };
}
