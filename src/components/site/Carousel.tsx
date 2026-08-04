'use client';
import { Children, useRef } from 'react';
import { ChevronRight } from '@/components/icons';

/**
 * Horizontal, swipeable carousel. Native touch/trackpad swipe via overflow-x,
 * scroll-snap for tidy stops, plus prev/next arrows for mouse users on wider
 * screens. Each child becomes a fixed-width, snap-aligned slide.
 */
export default function Carousel({
  children, itemWidth = 'w-[280px] sm:w-[320px]',
}: { children: React.ReactNode; itemWidth?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  const items = Children.toArray(children);

  return (
    <div className="group/car relative">
      <div ref={ref} className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1">
        {items.map((c, i) => (
          <div key={i} className={`shrink-0 snap-start ${itemWidth}`}>{c}</div>
        ))}
      </div>

      {/* Arrows (hidden on touch-first small screens; fade in on hover) */}
      <button onClick={() => scroll(-1)} aria-label="Previous"
        className="absolute left-1.5 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] shadow-[var(--shadow-card)] transition-opacity hover:text-brand-600 sm:grid sm:opacity-0 sm:group-hover/car:opacity-100">
        <ChevronRight width={20} height={20} className="rotate-180" />
      </button>
      <button onClick={() => scroll(1)} aria-label="Next"
        className="absolute right-1.5 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] shadow-[var(--shadow-card)] transition-opacity hover:text-brand-600 sm:grid sm:opacity-0 sm:group-hover/car:opacity-100">
        <ChevronRight width={20} height={20} />
      </button>
    </div>
  );
}
