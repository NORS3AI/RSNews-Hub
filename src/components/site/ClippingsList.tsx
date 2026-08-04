'use client';
import { useState } from 'react';
import { useSaved } from './StarProvider';
import { makeQuoteImage, downloadDataUrl } from '@/lib/quoteImage';
import { Scissors, Download, Copy, Trash } from '@/components/icons';

export default function ClippingsList() {
  const { clippings, removeClipping, ready } = useSaved();
  const [preview, setPreview] = useState<string | null>(null);

  function urlFor(slug: string) {
    return typeof window !== 'undefined' ? `${window.location.host}/docs/article/${slug}` : `/docs/article/${slug}`;
  }
  function imageFor(c: (typeof clippings)[number]) {
    return makeQuoteImage({ quote: c.quote, title: c.title, author: c.author, url: urlFor(c.slug), slug: c.slug });
  }

  return (
    <div className="module">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Scissors className="text-brand-600" width={20} height={20} /> Your clippings</h1>
      </div>

      {!ready ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : clippings.length === 0 ? (
        <p className="text-[var(--muted)]">
          No clippings yet. While reading any article, highlight a passage and tap <strong>Clip</strong> — it becomes a branded quote image you can download and share.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">{clippings.length} saved quote{clippings.length === 1 ? '' : 's'}. Download any as an image for social.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {clippings.map((c) => (
              <div key={c.id} className="card flex flex-col gap-3 p-4">
                <blockquote className="text-[15px] font-semibold leading-snug">“{c.quote}”</blockquote>
                <div className="text-xs text-[var(--muted)]">
                  <span className="font-bold text-[var(--fg)]">{c.title}</span>{c.author ? ` — ${c.author}` : ''}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button onClick={() => downloadDataUrl(imageFor(c), `rsnews-clip-${c.slug || 'quote'}.png`)} className="btn-primary btn-sm">
                    <Download width={15} height={15} /> Image
                  </button>
                  <button onClick={() => setPreview(imageFor(c))} className="btn-outline btn-sm">Preview</button>
                  <button onClick={() => navigator.clipboard?.writeText(`“${c.quote}” — ${c.title}`)} className="btn-outline btn-sm">
                    <Copy width={15} height={15} /> Copy
                  </button>
                  <button onClick={() => removeClipping(c.id)} className="btn-ghost btn-sm text-red-500" aria-label="Delete clipping">
                    <Trash width={15} height={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Quote image" className="relative z-10 max-h-[88dvh] w-auto rounded-2xl border border-[var(--border)] shadow-modal" />
        </div>
      )}
    </div>
  );
}
