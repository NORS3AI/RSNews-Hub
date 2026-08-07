'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSaved } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { Pin, X, ExpandLR, CollapseLR, ChevronRight } from '@/components/icons';

/**
 * The pinned strip at the very top shows the reader's "Pinned" list (saved via
 * the pin button). Collapsed, each item is a compact square (just the pin icon in
 * an orange-bordered box) that expands on hover to reveal the title; the Expand
 * toggle (far left) opens every title at once. When the titles overflow the row,
 * left/right arrows appear so a mouse user can page through them (touch users can
 * just swipe). Clear all (far right) empties it — behind a Yes/No confirm.
 */
export default function StarStrip() {
  const { toRead, removeToRead, clearToRead, ready } = useSaved();
  const { openArticle } = useArticleModal();
  const [expanded, setExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Arrow paging: track how far the row can scroll in each direction so a mouse
  // user (no swipe) can always reach titles that overflow to the right.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);
  const updateArrows = useCallback(() => {
    const e = scrollRef.current;
    if (!e) return;
    setCanL(e.scrollLeft > 2);
    setCanR(e.scrollLeft + e.clientWidth < e.scrollWidth - 2);
  }, []);
  useEffect(() => {
    const e = scrollRef.current;
    if (!e) return;
    updateArrows();
    e.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => { e.removeEventListener('scroll', updateArrows); window.removeEventListener('resize', updateArrows); };
  }, [updateArrows, toRead, expanded]);
  const page = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });

  if (!ready || toRead.length === 0) return null;
  const overflowing = canL || canR;

  const arrow = (dir: 1 | -1, enabled: boolean) => (
    <button
      onClick={() => page(dir)} disabled={!enabled} tabIndex={enabled ? 0 : -1}
      aria-label={dir === 1 ? 'Show more pinned' : 'Show earlier pinned'}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:text-brand-600 ${enabled ? '' : 'invisible'}`}>
      <ChevronRight width={14} height={14} className={dir === -1 ? 'rotate-180' : ''} />
    </button>
  );

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Expand / collapse all titles */}
        <button onClick={() => setExpanded((e) => !e)}
          title={expanded ? 'Collapse' : 'Expand — show all titles'}
          aria-label={expanded ? 'Collapse pinned list' : 'Expand pinned list'} aria-pressed={expanded}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors hover:text-brand-600">
          {expanded ? <CollapseLR width={14} height={14} /> : <ExpandLR width={14} height={14} />}
        </button>

        <span className="shrink-0 pr-1 text-xs font-bold text-brand-600">Pinned</span>

        {/* Left arrow — only occupies space when the row can actually scroll. */}
        {overflowing && arrow(-1, canL)}

        <div ref={scrollRef} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none">
          {toRead.map((s) => (
            <div key={s.id}
              className={`group/chip flex h-8 shrink-0 items-center overflow-hidden rounded-md border border-brand-500 bg-[var(--card)] transition-[max-width] duration-200 ease-out ${expanded ? 'max-w-[280px]' : 'max-w-[34px] hover:max-w-[280px]'}`}>
              <button onClick={() => openArticle(s.slug)} className="flex h-full min-w-0 items-center gap-1.5 pl-2 pr-1" title={s.title}>
                <Pin width={16} height={16} strokeWidth={2.4} className="shrink-0 text-brand-600" />
                <span className={`truncate text-xs font-medium text-[var(--fg)] transition-opacity duration-150 ${expanded ? 'opacity-100' : 'opacity-0 group-hover/chip:opacity-100'}`}>
                  {s.title}
                </span>
              </button>
              <button onClick={() => removeToRead(s.id)} aria-label="Unpin"
                className={`mr-1 shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] ${expanded ? 'block' : 'hidden group-hover/chip:block'}`}>
                <X width={12} height={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Right arrow — the one that matters on desktop when titles run off-screen. */}
        {overflowing && arrow(1, canR)}

        {/* Clear all — press to reveal a Yes/No confirm so it isn't accidental. */}
        <div className="shrink-0">
          {confirmClear ? (
            <span className="flex items-center gap-1 text-xs font-semibold">
              <span className="pr-0.5 text-[var(--muted)]">Clear all?</span>
              <button onClick={() => { clearToRead(); setConfirmClear(false); }}
                className="rounded-md bg-red-600 px-2 py-1 text-white hover:bg-red-700">Yes</button>
              <button onClick={() => setConfirmClear(false)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:text-[var(--fg)]">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} title="Clear all pinned"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:text-red-600">
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
