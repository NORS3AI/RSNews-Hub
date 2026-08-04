'use client';
import { Children, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from '@/components/icons';

/**
 * Horizontal carousel with always-visible, good-sized click arrows (auto-hidden
 * at each end and when nothing overflows). Also supports native touch/trackpad
 * swipe and scroll-snap.
 */
export default function Carousel({
  children, itemWidth = 'w-[280px] sm:w-[320px]',
}: { children: React.ReactNode; itemWidth?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ atStart: true, atEnd: false, scrollable: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setS({ atStart: el.scrollLeft <= 2, atEnd: el.scrollLeft >= max - 2, scrollable: max > 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  const items = Children.toArray(children);

  const arrow =
    'absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border ' +
    'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] shadow-[var(--shadow-card)] transition ' +
    'hover:border-brand-400 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-0';

  return (
    <div className="relative">
      <div ref={ref} className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1">
        {items.map((c, i) => (
          <div key={i} className={`shrink-0 snap-start ${itemWidth}`}>{c}</div>
        ))}
      </div>

      {s.scrollable && (
        <>
          <button onClick={() => scroll(-1)} disabled={s.atStart} aria-label="Previous" className={`${arrow} -left-2 sm:-left-3`}>
            <ChevronRight width={22} height={22} className="rotate-180" />
          </button>
          <button onClick={() => scroll(1)} disabled={s.atEnd} aria-label="Next" className={`${arrow} -right-2 sm:-right-3`}>
            <ChevronRight width={22} height={22} />
          </button>
        </>
      )}
    </div>
  );
}
