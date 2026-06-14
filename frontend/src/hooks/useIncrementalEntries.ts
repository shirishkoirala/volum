import { UIEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const LARGE_FOLDER_THRESHOLD = 600;
const INITIAL_VISIBLE_COUNT = 240;
const VISIBLE_COUNT_BATCH = 240;
const LOAD_MORE_DISTANCE_PX = 720;

type IncrementalEntriesOptions = {
  totalCount?: number;
  resetKey?: string;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export function useIncrementalEntries<T>(entries: T[], options: IncrementalEntriesOptions = {}) {
  const totalCount = options.totalCount ?? entries.length;
  const incremental = totalCount > LARGE_FOLDER_THRESHOLD || entries.length > LARGE_FOLDER_THRESHOLD;
  const [visibleCount, setVisibleCount] = useState(() => (incremental ? INITIAL_VISIBLE_COUNT : entries.length));
  const previousLoadedCountRef = useRef(entries.length);
  const lastResetKeyRef = useRef(options.resetKey);
  const loadMoreRef = useRef<() => void>(() => undefined);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (lastResetKeyRef.current === options.resetKey) return;
    lastResetKeyRef.current = options.resetKey;
    previousLoadedCountRef.current = entries.length;
    setVisibleCount(incremental ? Math.min(INITIAL_VISIBLE_COUNT, entries.length) : entries.length);
  }, [entries.length, incremental, options.resetKey]);

  useEffect(() => {
    if (!incremental) setVisibleCount(entries.length);
  }, [entries.length, incremental]);

  useEffect(() => {
    const previousLoadedCount = previousLoadedCountRef.current;
    previousLoadedCountRef.current = entries.length;
    if (!incremental || entries.length <= previousLoadedCount) return;
    setVisibleCount((count) => {
      if (count < previousLoadedCount) return count;
      return Math.min(entries.length, count + VISIBLE_COUNT_BATCH);
    });
  }, [entries.length, incremental]);

  const loadMore = useCallback(() => {
    if (!incremental) return;
    if (visibleCount < entries.length) {
      setVisibleCount((count) => Math.min(entries.length, count + VISIBLE_COUNT_BATCH));
      return;
    }
    if (visibleCount < totalCount && !options.loadingMore) {
      options.onLoadMore?.();
    }
  }, [entries.length, incremental, options, totalCount, visibleCount]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  const handleScroll = useCallback((event: UIEvent<HTMLElement>) => {
    if (!incremental || options.loadingMore) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < LOAD_MORE_DISTANCE_PX) loadMore();
  }, [incremental, loadMore, options.loadingMore]);

  const renderedCount = incremental ? Math.min(visibleCount, entries.length) : entries.length;

  const loadMoreSentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node || !incremental || typeof IntersectionObserver === 'undefined') return;

    const scrollParent = node.parentElement;
    if (!scrollParent) return;
    const usesLocalRoot = scrollParent.scrollHeight > scrollParent.clientHeight;

    const observer = new IntersectionObserver((observedEntries) => {
      const reachedSentinel = observedEntries.some((entry) => entry.isIntersecting);
      const remaining = usesLocalRoot
        ? scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      const hasScrolled = usesLocalRoot ? scrollParent.scrollTop > 0 : window.scrollY > 0;
      const needsInitialFill = usesLocalRoot
        ? scrollParent.scrollHeight <= scrollParent.clientHeight
        : document.documentElement.scrollHeight <= window.innerHeight;
      const shouldLoadMore = needsInitialFill || (hasScrolled && remaining < LOAD_MORE_DISTANCE_PX);
      if (reachedSentinel && shouldLoadMore && !options.loadingMore) {
        loadMoreRef.current();
      }
    }, {
      root: usesLocalRoot ? scrollParent : null,
      rootMargin: `${LOAD_MORE_DISTANCE_PX}px 0px`,
    });

    observer.observe(node);
    observerRef.current = observer;
  }, [incremental, options.loadingMore]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const visibleEntries = useMemo(() => entries.slice(0, renderedCount), [entries, renderedCount]);

  return {
    incremental,
    totalCount,
    renderedCount,
    hasMore: renderedCount < totalCount,
    visibleEntries,
    loadMore,
    handleScroll,
    loadMoreSentinelRef,
    loadingMore: options.loadingMore ?? false,
  };
}
