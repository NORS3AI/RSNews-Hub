'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSaved } from './StarProvider';
import { makeQuoteImage, downloadDataUrl } from '@/lib/quoteImage';
import { Scissors, Download, Copy, X } from '@/components/icons';

type Ctx = { text: string; slug: string; title: string; author: string | null };
type Clip = Ctx & { img: string; url: string };

/**
 * Site-wide "news clipping" tool: highlight text inside any article reader
 * ([data-reader]) and a Clip button appears; clicking it turns the selection
 * into a downloadable branded quote image (and saves it to Clippings).
 */
export default function ReaderClipper() {
  const { addClipping } = useSaved();
  const [fab, setFab] = useState<{ x: number; y: number; ctx: Ctx } | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);

  const readContext = useCallback((): { rect: DOMRect; ctx: Ctx } | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 4) return null;
    let node: Node | null = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    const reader = node && (node as Element).closest ? (node as Element).closest('[data-reader]') : null;
    if (!reader) return null;
    return {
      rect: sel.getRangeAt(0).getBoundingClientRect(),
      ctx: {
        text,
        slug: reader.getAttribute('data-slug') || '',
        title: reader.getAttribute('data-title') || '',
        author: reader.getAttribute('data-author') || null,
      },
    };
  }, []);

  useEffect(() => {
    const onSel = () => {
      const r = readContext();
      if (!r) { setFab(null); return; }
      let y = r.rect.top - 46;
      if (y < 60) y = r.rect.bottom + 10;
      const x = Math.max(8, Math.min(r.rect.left + r.rect.width / 2 - 44, window.innerWidth - 100));
      setFab({ x, y, ctx: r.ctx });
    };
    const hide = () => setFab(null);
    document.addEventListener('selectionchange', onSel);
    document.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('selectionchange', onSel); document.removeEventListener('scroll', hide, true); };
  }, [readContext]);

  function doClip(ctx: Ctx) {
    const url = `${location.host}/docs/article/${ctx.slug}`;
    const img = makeQuoteImage({ quote: ctx.text, title: ctx.title, author: ctx.author, url, slug: ctx.slug });
    setClip({ ...ctx, img, url });
    addClipping({ quote: ctx.text, title: ctx.title, author: ctx.author, slug: ctx.slug });
    setFab(null);
    try { window.getSelection()?.removeAllRanges(); } catch {}
  }

  return (
    <>
      {fab && (
        <button
          style={{ top: fab.y, left: fab.x }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => doClip(fab.ctx)}
          className="fixed z-[150] flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-sm font-extrabold text-white shadow-[var(--shadow-hover)] hover:bg-brand-700"
        >
          <Scissors width={16} height={16} /> Clip
        </button>
      )}

      {clip && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setClip(null)} />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-modal">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <h3 className="text-lg font-extrabold">News clipping</h3>
              <button onClick={() => setClip(null)} className="btn-ghost h-9 w-9 !px-0" aria-label="Close"><X /></button>
            </div>
            <div className="p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={clip.img} alt="Quote image" className="mb-4 w-full rounded-xl border border-[var(--border)]" />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => downloadDataUrl(clip.img, `rsnews-clip-${clip.slug || 'quote'}.png`)} className="btn-primary btn-sm">
                  <Download width={15} height={15} /> Download image
                </button>
                <button onClick={() => navigator.clipboard?.writeText(`“${clip.text}” — ${clip.title}`)} className="btn-outline btn-sm">
                  <Copy width={15} height={15} /> Copy quote
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">Saved to your Clippings. Great for sharing on social.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
