import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Masonry layout: as many columns as fit, each card placed into the currently
 * shortest column (in order), so opening a tall card doesn't leave empty space
 * beside it. Card heights are measured and re-measured when they change.
 */
export function Masonry({ items, minColumn = 320, gap = 14 }: { items: { key: string; node: ReactNode }[]; minColumn?: number; gap?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  const [heights, setHeights] = useState<Record<string, number>>({});
  // One shared observer for every card; each card element carries its key in data-key.
  const observer = useRef<ResizeObserver | null>(null);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const refs = useRef(new Map<string, (el: HTMLDivElement | null) => void>());

  // Column count from the available width.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setCols(Math.max(1, Math.floor((el.clientWidth + gap) / (minColumn + gap))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minColumn, gap]);

  const getObserver = useCallback(() => {
    if (!observer.current) {
      observer.current = new ResizeObserver(entries => {
        setHeights(prev => {
          let next = prev;
          for (const entry of entries) {
            const key = (entry.target as HTMLElement).dataset.key;
            if (!key) continue;
            const h = Math.round(entry.target.getBoundingClientRect().height);
            // Only store real changes to avoid layout loops.
            if (Math.abs((next[key] ?? -1) - h) > 1) next = { ...next, [key]: h };
          }
          return next;
        });
      });
    }
    return observer.current;
  }, []);

  useEffect(() => () => { observer.current?.disconnect(); observer.current = null; }, []);

  // Stable ref callback per key, so React doesn't detach/re-attach on every render.
  const measure = (key: string) => {
    let ref = refs.current.get(key);
    if (!ref) {
      ref = (el: HTMLDivElement | null) => {
        const previous = elements.current.get(key);
        if (previous && previous !== el) { getObserver().unobserve(previous); elements.current.delete(key); }
        if (el) { elements.current.set(key, el); getObserver().observe(el); }
      };
      refs.current.set(key, ref);
    }
    return ref;
  };

  // Forget heights and refs of cards that are gone.
  const keySignature = items.map(it => it.key).join('\u0000');
  useEffect(() => {
    const live = new Set(items.map(it => it.key));
    for (const key of refs.current.keys()) if (!live.has(key)) refs.current.delete(key);
    setHeights(prev => {
      const stale = Object.keys(prev).filter(key => !live.has(key));
      if (!stale.length) return prev;
      const next = { ...prev };
      for (const key of stale) delete next[key];
      return next;
    });
  }, [keySignature]);

  // Greedy placement into the shortest column, in order.
  const columns: { key: string; node: ReactNode }[][] = Array.from({ length: cols }, () => []);
  const colH = new Array(cols).fill(0);
  for (const it of items) {
    let best = 0;
    for (let i = 1; i < cols; i++) if (colH[i] < colH[best] - 1) best = i;
    columns[best].push(it);
    colH[best] += (heights[it.key] ?? 120) + gap;
  }

  return (
    <div ref={wrap} className="masonry" style={{ gap }}>
      {columns.map((col, i) => (
        <div key={i} className="masonry-col" style={{ gap }}>
          {col.map(it => <div key={it.key} data-key={it.key} ref={measure(it.key)} className="masonry-item">{it.node}</div>)}
        </div>
      ))}
    </div>
  );
}
