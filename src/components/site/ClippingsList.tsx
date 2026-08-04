'use client';
import { useEffect, useState } from 'react';
import { useSaved, type Clipping } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { clipShareText } from './ReaderClipper';
import { makeQuoteImage, downloadDataUrl, downloadImage } from '@/lib/quoteImage';
import { track } from '@/lib/analytics/track';
import { Scissors, Download, Copy, Trash, ArrowRight, X } from '@/components/icons';

const clipEv = (action: string, c: Clipping) => track({ type: 'clip', subjectType: 'clip', subjectId: c.id, pageType: 'clippings', props: { action, kind: c.kind ?? (c.image ? 'comic' : 'quote'), slug: c.slug } });

const isComic = (c: Clipping) => c.kind === 'comic' || !!c.image;

// Icon-only action button whose label slides out on hover (keeps rows compact
// in the narrow 3-column layout instead of wrapping to a new line).
function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`group/act inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-2 py-1.5 transition hover:border-brand-400 hover:bg-[var(--bg-soft)] ${danger ? 'text-red-500 hover:border-red-300' : ''}`}>
      {children}
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-bold opacity-0 transition-all duration-200 group-hover/act:ml-1.5 group-hover/act:max-w-[130px] group-hover/act:opacity-100">{label}</span>
    </button>
  );
}

export default function ClippingsList() {
  const { clippings, removeClipping, ready } = useSaved();
  const { openArticle } = useArticleModal();
  const [view, setView] = useState<'cards' | 'images'>('cards');
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const openZoom = (z: { src: string; alt: string }, c: Clipping) => { clipEv('expand', c); setZoom(z); };
  const setViewTracked = (v: 'cards' | 'images') => { track({ type: 'clip', subjectType: 'clip', pageType: 'clippings', props: { action: 'view', view: v } }); setView(v); };

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [zoom]);

  function urlFor(slug?: string) {
    return typeof window !== 'undefined' ? `${window.location.host}/docs/article/${slug ?? ''}` : `/docs/article/${slug ?? ''}`;
  }
  function imageFor(c: Clipping) {
    if (isComic(c)) return c.image as string;
    return makeQuoteImage({ quote: c.quote ?? '', title: c.title, author: c.author, url: urlFor(c.slug), slug: c.slug });
  }

  function Actions({ c }: { c: Clipping }) {
    if (isComic(c)) {
      return (
        <div className="mt-auto flex flex-nowrap items-center gap-1.5 pt-3">
          <IconAction label="Download image" onClick={() => { clipEv('download', c); downloadImage(c.image as string, `backroom-humor-${(c.title || 'comic').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`); }}><Download width={15} height={15} /></IconAction>
          <IconAction label="Delete" danger onClick={() => { clipEv('delete', c); removeClipping(c.id); }}><Trash width={15} height={15} /></IconAction>
        </div>
      );
    }
    return (
      <div className="mt-auto flex flex-nowrap items-center gap-1.5 pt-3">
        <IconAction label="Download image" onClick={() => { clipEv('download', c); downloadDataUrl(imageFor(c), `rsnews-clip-${c.slug || 'quote'}.png`); }}><Download width={15} height={15} /></IconAction>
        <IconAction label="Open article" onClick={() => { clipEv('open', c); c.slug && openArticle(c.slug); }}><ArrowRight width={15} height={15} /></IconAction>
        <IconAction label="Copy quote" onClick={() => { clipEv('copy', c); navigator.clipboard?.writeText(clipShareText(c.quote ?? '', c.title, c.slug ?? '')); }}><Copy width={15} height={15} /></IconAction>
        <IconAction label="Delete" danger onClick={() => { clipEv('delete', c); removeClipping(c.id); }}><Trash width={15} height={15} /></IconAction>
      </div>
    );
  }

  return (
    <div className="module">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Scissors className="text-brand-600" width={20} height={20} /> Your clippings</h1>
        {ready && clippings.length > 0 && (
          <div className="inline-flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-0.5">
            {(['cards', 'images'] as const).map((v) => (
              <button key={v} onClick={() => setViewTracked(v)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-bold capitalize ${view === v ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {!ready ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : clippings.length === 0 ? (
        <p className="text-[var(--muted)]">
          No clippings yet. Highlight a passage in an article to save it as a quote image, or open a comic and tap <strong>Save to clippings</strong>.
        </p>
      ) : view === 'images' ? (
        // Masonry (Pinterest-style): items keep their natural height and tile.
        <div className="columns-2 gap-4 sm:columns-3">
          {clippings.map((c) => (
            <div key={c.id} className="card mb-4 flex break-inside-avoid flex-col p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageFor(c)} alt={isComic(c) ? c.title : 'Quote image'} loading="lazy"
                onClick={() => openZoom({ src: imageFor(c), alt: isComic(c) ? c.title : 'Quote image' }, c)}
                className="w-full cursor-zoom-in rounded-lg" />
              <Actions c={c} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clippings.map((c) => (
            <div key={c.id} className="card flex flex-col p-4">
              {isComic(c) ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image as string} alt={c.title} onClick={() => openZoom({ src: c.image as string, alt: c.title }, c)} className="h-16 w-16 shrink-0 cursor-zoom-in rounded-lg object-cover" />
                  <div>
                    <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">Comic</span>
                    <div className="mt-1 font-bold leading-snug">{c.title}</div>
                  </div>
                </div>
              ) : (
                <>
                  <blockquote className="whitespace-pre-line text-[15px] font-semibold leading-snug">“{c.quote}”</blockquote>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    <span className="font-bold text-[var(--fg)]">{c.title}</span>{c.author ? ` — ${c.author}` : ''}
                  </div>
                </>
              )}
              <Actions c={c} />
            </div>
          ))}
        </div>
      )}

      {/* Click-to-zoom lightbox — same feel as tapping a comic on the homepage. */}
      {zoom && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-8 animate-fade-in" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" />
          <button onClick={() => setZoom(null)} className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25" aria-label="Close"><X /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.alt} onClick={(e) => e.stopPropagation()} className="relative z-10 max-h-[88dvh] w-auto max-w-full rounded-xl shadow-modal" />
        </div>
      )}
    </div>
  );
}
