'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Eye, Newspaper, X, Pin } from '@/components/icons';
import { useScrollLock } from '@/lib/useScrollLock';
import { useSaved } from './StarProvider';
import { linkSource, shortSource, postedLabel } from '@/lib/industry';

export type IndustryItem = { id: string; title: string; url: string; source: string | null; author?: string | null; views: number; postedAt: string | Date };

const MODAL_LIMIT = 50;

/** Pin toggle for an Industry News link. Sits OUTSIDE the row's link so tapping
 *  it pins/unpins instead of opening the source. External pins carry the tracked
 *  go-path as their href, so the top strip opens (and counts) them like a click. */
function PinButton({ l, variant }: { l: IndustryItem; variant: 'card' | 'modal' }) {
  const { isToRead, toggleToRead, ready } = useSaved();
  const pinned = ready && isToRead(l.id); // avoid a pressed-state flicker before the cache hydrates
  const cls = variant === 'card'
    ? `h-9 w-9 ${pinned ? 'bg-white text-brand-700' : 'text-white/75 hover:bg-white/15 hover:text-white'}`
    : `h-10 w-10 ${pinned ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-brand-600'}`;
  return (
    <button type="button"
      onClick={() => toggleToRead({ id: l.id, title: l.title, slug: '', href: `/api/industry/${l.id}/go` })}
      aria-pressed={pinned} title={pinned ? 'Unpin' : 'Pin to your top strip'}
      aria-label={pinned ? `Unpin ${l.title}` : `Pin ${l.title} to your top strip`}
      className={`mt-0.5 grid shrink-0 place-items-center rounded-lg transition ${cls}`}>
      <Pin width={variant === 'card' ? 17 : 19} height={variant === 'card' ? 17 : 19} strokeWidth={2.3} />
    </button>
  );
}

/** Compact row for the small orange card on the homepage. */
function CardRow({ l }: { l: IndustryItem }) {
  return (
    <div className="oind-row flex items-start gap-2 border-t border-white/20 py-3.5 first:border-t-0">
      <a href={`/api/industry/${l.id}/go`} target="_blank" rel="noopener noreferrer"
        className="group/l flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 text-white"><ExternalLink width={17} height={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-snug tracking-tight text-white group-hover/l:underline">{l.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
            {l.author && <span className="font-bold">{l.author}</span>}
            <span className="font-bold">{shortSource(linkSource(l.url, l.source))}</span>
            <span>{postedLabel(l.postedAt)}</span>
            <span className="flex items-center gap-1"><Eye width={12} height={12} />{l.views}</span>
          </span>
        </span>
      </a>
      <PinButton l={l} variant="card" />
    </div>
  );
}

/** Big, theme-aware row for the modal — fades in as it scrolls into view. */
function ModalRow({ l, root }: { l: IndustryItem; root: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { root: root.current, rootMargin: '0px 0px -8% 0px', threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);
  return (
    <div ref={ref}
      className={`flex items-start gap-3 border-b border-[var(--border)] py-5 transition-all duration-500 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
      <a href={`/api/industry/${l.id}/go`} target="_blank" rel="noopener noreferrer"
        className="group/l flex min-w-0 flex-1 items-start gap-4">
        <span className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--bg-soft)] text-brand-600"><ExternalLink width={20} height={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-extrabold leading-snug tracking-tight text-[var(--fg)] group-hover/l:text-brand-600 sm:text-2xl">{l.title}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            {l.author && <span className="font-bold text-[var(--fg)]/80">{l.author}</span>}
            <span className="font-bold text-[var(--fg)]/80">{linkSource(l.url, l.source)}</span>
            <span>{postedLabel(l.postedAt)}</span>
            <span className="flex items-center gap-1"><Eye width={14} height={14} />{l.views}</span>
          </span>
        </span>
      </a>
      <PinButton l={l} variant="modal" />
    </div>
  );
}

/**
 * Industry News — a tall, narrow orange card of curated external links.
 * Clicking the big heading opens a large, article-style modal (theme-aware)
 * that shows the most recent 50 links with a scroll-reveal fade-in; the full
 * list lives in the Archive. Each link opens its source in a new tab.
 */
export default function IndustryNews({ links }: { links: IndustryItem[] }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const modalLinks = links.slice(0, MODAL_LIMIT);

  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!links.length) return null;

  return (
    <>
      <section className="module module-orange w-full max-w-md bg-brand-600 text-white">
        <button onClick={() => setOpen(true)} className="ind-head group/head flex items-center gap-2.5 text-left" title="Expand Industry News">
          <Newspaper width={32} height={32} />
          <span className="ind-bigtitle text-[34px] font-black leading-[0.95] tracking-tight group-hover/head:underline sm:text-[40px]">Industry News</span>
        </button>
        <p className="ind-sub mb-4 mt-2 text-sm font-semibold text-white/80">Curated links — tap the title to expand</p>
        <div className="industry-scroll max-h-[460px] overflow-y-auto pr-1">
          {links.slice(0, 12).map((l) => <CardRow key={l.id} l={l} />)}
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-hidden animate-fade-in" role="dialog" aria-modal="true" aria-label="Industry News">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex h-[100dvh] w-full max-w-4xl flex-col sm:h-[92dvh] sm:my-[4dvh] animate-scale-in">
            <div className="flex h-full flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-modal sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-8">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2.5 text-2xl font-black tracking-tight sm:text-3xl"><Newspaper width={28} height={28} className="text-brand-600" /> Industry News</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Most recent {modalLinks.length} · curated by our team</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href="/docs/archive/industry" className="btn-outline btn-sm hidden sm:inline-flex">View archive</Link>
                  <button onClick={() => setOpen(false)} className="btn-ghost h-9 w-9 !px-0" aria-label="Close"><X /></button>
                </div>
              </div>
              <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-8">
                {modalLinks.map((l) => <ModalRow key={l.id} l={l} root={bodyRef} />)}
                <div className="py-7 text-center">
                  <Link href="/docs/archive/industry" className="text-sm font-bold text-brand-600 hover:underline">See the full Industry News archive →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
