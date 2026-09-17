'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSaved, type Clipping } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { useScrollLock } from '@/lib/useScrollLock';
import { clipShareText } from './ReaderClipper';
import { makeQuoteImage, preloadQuoteAssets, downloadDataUrl, downloadImage, type QuoteTheme } from '@/lib/quoteImage';
import { track } from '@/lib/analytics/track';
import { Scissors, Download, Copy, Trash, ArrowRight, X, Check } from '@/components/icons';

const CLIP_THEME_KEY = 'rsnews_cliptheme_v1';
// Mini-swatch preview of each quote-image look — [body, footer strip].
const THEMES: { key: QuoteTheme; label: string; swatch: [string, string] }[] = [
  { key: 'dark', label: 'Dark', swatch: ['#2b333d', '#141a21'] },
  { key: 'light', label: 'Light', swatch: ['#f7f0e2', '#e8dec9'] },
  { key: 'rs', label: 'RS', swatch: ['#f7edd8', '#2b333c'] },
];

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
  const [clipTheme, setClipTheme] = useState<QuoteTheme>('dark');
  const [customize, setCustomize] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  // Column count for the Images masonry, responsive to viewport width.
  const [ncol, setNcol] = useState(3);
  useEffect(() => {
    const calc = () => setNcol(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Quote-image look (dark / light / RS), remembered per account on this device.
  const [assetsTick, setAssetsTick] = useState(0);
  useEffect(() => {
    try { const t = localStorage.getItem(CLIP_THEME_KEY); if (t === 'dark' || t === 'light' || t === 'rs') setClipTheme(t); } catch { /* ignore */ }
    // Once the logo + parchment finish loading, repaint the quote images.
    preloadQuoteAssets().then(() => setAssetsTick((n) => n + 1));
  }, []);
  const chooseTheme = (t: QuoteTheme) => {
    setClipTheme(t);
    try { localStorage.setItem(CLIP_THEME_KEY, t); } catch { /* ignore */ }
    track({ type: 'clip', subjectType: 'clip', pageType: 'clippings', props: { action: 'theme', theme: t } });
  };
  const openZoom = (z: { src: string; alt: string }, c: Clipping) => { clipEv('expand', c); setZoom(z); };
  const setViewTracked = (v: 'cards' | 'images') => { track({ type: 'clip', subjectType: 'clip', pageType: 'clippings', props: { action: 'view', view: v } }); setView(v); };

  useScrollLock(!!zoom);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  function urlFor(slug?: string) {
    return typeof window !== 'undefined' ? `${window.location.host}/docs/article/${slug ?? ''}` : `/docs/article/${slug ?? ''}`;
  }
  // Generate each quote image once per (clip, theme) and cache the data URL, so
  // re-renders that don't change the theme (opening/closing Customize, hovering,
  // etc.) reuse the exact same src — the images never regenerate or flash.
  const quoteImages = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clippings) {
      if (!isComic(c)) m.set(c.id, makeQuoteImage({ quote: c.quote ?? '', title: c.title, author: c.author, url: urlFor(c.slug), slug: c.slug, theme: clipTheme }));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clippings, clipTheme, assetsTick]);
  function imageFor(c: Clipping) {
    if (isComic(c)) return c.image as string;
    return quoteImages.get(c.id) ?? '';
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
        <h1 className="flex items-center gap-2 text-xl font-bold"><Scissors className="text-brand-600" width={20} height={20} /> Your RS News Clippings</h1>
        {ready && clippings.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Customize the look of quote clippings (dark / light / RS). */}
            <div className="relative">
              <button onClick={() => setCustomize((o) => !o)} aria-expanded={customize}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-1.5 text-sm font-bold text-[var(--muted)] hover:text-[var(--fg)]">
                <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: THEMES.find((t) => t.key === clipTheme)!.swatch[0] }} />
                Customize
              </button>
              {customize && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setCustomize(false)} />
                  <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 text-left shadow-2xl">
                    <div className="px-1.5 pb-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">Quote clipping style</div>
                    {THEMES.map((t) => (
                      <button key={t.key} onClick={() => chooseTheme(t.key)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-base font-bold ${clipTheme === t.key ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'hover:bg-[var(--card-2)]'}`}>
                        <span className="flex h-8 w-8 shrink-0 flex-col overflow-hidden rounded-lg border border-black/15">
                          <span className="flex-1" style={{ background: t.swatch[0] }} />
                          <span className="h-3" style={{ background: t.swatch[1] }} />
                        </span>
                        {t.label}
                        {clipTheme === t.key && <Check width={15} height={15} className="ml-auto text-brand-600" />}
                      </button>
                    ))}
                    <p className="px-1.5 pt-2 text-xs leading-snug text-[var(--muted)]">Applies to quote images from articles. Remembered for next time.</p>
                  </div>
                </>
              )}
            </div>
            <div className="inline-flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-0.5">
              {(['cards', 'images'] as const).map((v) => (
                <button key={v} onClick={() => setViewTracked(v)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-bold capitalize ${view === v ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
                  {v}
                </button>
              ))}
            </div>
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
        // Pinterest-style masonry: pack items into tight flex columns in
        // reading order (round-robin) — no row gaps, jagged bottoms — while a
        // clip keeps its spot when toggling Cards <-> Images.
        <div className="flex items-start gap-4">
          {Array.from({ length: ncol }, (_, ci) => clippings.filter((_c, i) => i % ncol === ci)).map((col, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
              {col.map((c) => (
                <div key={c.id} className="card flex flex-col p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageFor(c)} alt={isComic(c) ? c.title : 'Quote image'} loading="lazy"
                    onClick={() => openZoom({ src: imageFor(c), alt: isComic(c) ? c.title : 'Quote image' }, c)}
                    className="w-full cursor-zoom-in rounded-lg" />
                  <Actions c={c} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clippings.map((c) => (
            <div key={c.id} className="card flex flex-col p-4">
              {/* Tapping the card body opens the same enlarged overlay as the
                  images view (the actions row below stays separate). */}
              {isComic(c) ? (
                <button onClick={() => openZoom({ src: c.image as string, alt: c.title }, c)} className="flex cursor-zoom-in items-center gap-3 text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image as string} alt={c.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <span>
                    <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Comic</span>
                    <span className="mt-1 block font-bold leading-snug">{c.title}</span>
                  </span>
                </button>
              ) : (
                <button onClick={() => openZoom({ src: imageFor(c), alt: 'Quote image' }, c)} className="cursor-zoom-in text-left">
                  <blockquote className="whitespace-pre-line text-[15px] font-semibold leading-snug">“{c.quote}”</blockquote>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    <span className="font-bold text-[var(--fg)]">{c.title}</span>{c.author ? ` — ${c.author}` : ''}
                  </div>
                </button>
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
