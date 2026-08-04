'use client';
import { useState } from 'react';
import { useSaved, type Clipping } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { clipShareText } from './ReaderClipper';
import { makeQuoteImage, downloadDataUrl } from '@/lib/quoteImage';
import { Scissors, Download, Copy, Trash, ArrowRight } from '@/components/icons';

export default function ClippingsList() {
  const { clippings, removeClipping, ready } = useSaved();
  const { openArticle } = useArticleModal();
  const [view, setView] = useState<'cards' | 'images'>('cards');

  function urlFor(slug: string) {
    return typeof window !== 'undefined' ? `${window.location.host}/docs/article/${slug}` : `/docs/article/${slug}`;
  }
  function imageFor(c: Clipping) {
    return makeQuoteImage({ quote: c.quote, title: c.title, author: c.author, url: urlFor(c.slug), slug: c.slug });
  }

  function Actions({ c }: { c: Clipping }) {
    const act = 'btn-sm !gap-1 !px-2.5 whitespace-nowrap';
    return (
      <div className="mt-auto flex flex-nowrap items-center gap-1.5 pt-3">
        <button onClick={() => downloadDataUrl(imageFor(c), `rsnews-clip-${c.slug || 'quote'}.png`)} className={`btn-primary ${act}`}>
          <Download width={14} height={14} /> Image
        </button>
        <button onClick={() => openArticle(c.slug)} className={`btn-outline ${act}`}>
          <ArrowRight width={14} height={14} /> Open article
        </button>
        <button onClick={() => navigator.clipboard?.writeText(clipShareText(c.quote, c.title, c.slug))} className={`btn-outline ${act}`}>
          <Copy width={14} height={14} /> Copy quote
        </button>
        <button onClick={() => removeClipping(c.id)} className="btn-ghost btn-sm !px-2 text-red-500" aria-label="Delete clipping">
          <Trash width={14} height={14} />
        </button>
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
              <button key={v} onClick={() => setView(v)}
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
          No clippings yet. While reading any article, highlight a passage and tap <strong>Clip</strong> — it becomes a branded quote image you can save, download, and share.
        </p>
      ) : view === 'images' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {clippings.map((c) => (
            <div key={c.id} className="card flex flex-col p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageFor(c)} alt="Quote image" loading="lazy" className="w-full rounded-lg" />
              <Actions c={c} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {clippings.map((c) => (
            <div key={c.id} className="card flex flex-col p-4">
              <blockquote className="text-[15px] font-semibold leading-snug">“{c.quote}”</blockquote>
              <div className="mt-2 text-xs text-[var(--muted)]">
                <span className="font-bold text-[var(--fg)]">{c.title}</span>{c.author ? ` — ${c.author}` : ''}
              </div>
              <Actions c={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
