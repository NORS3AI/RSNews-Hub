'use client';
import { useState } from 'react';
import { ExternalLink, Eye, Newspaper, X } from '@/components/icons';
import { linkSource, shortSource, postedLabel } from '@/lib/industry';

export type IndustryItem = { id: string; title: string; url: string; source: string | null; views: number; postedAt: string | Date };

function Row({ l, big }: { l: IndustryItem; big?: boolean }) {
  return (
    <a href={`/api/industry/${l.id}/go`} target="_blank" rel="noopener noreferrer"
      className="group flex items-start gap-3 border-t border-white/20 py-3.5 first:border-t-0">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 text-white"><ExternalLink width={17} height={17} /></span>
      <span className="min-w-0 flex-1">
        <span className={`block font-extrabold leading-snug tracking-tight text-white group-hover:underline ${big ? 'text-xl' : 'text-lg'}`}>{l.title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
          <span className="font-bold">{shortSource(linkSource(l.url, l.source))}</span>
          <span>{postedLabel(l.postedAt)}</span>
          <span className="flex items-center gap-1"><Eye width={12} height={12} />{l.views}</span>
        </span>
      </span>
    </a>
  );
}

/**
 * Industry News — a tall, narrow orange module of curated external links.
 * Clicking the big heading opens a scrollable modal with the full list; each
 * link opens its source in a new tab (and counts a click via /api/industry).
 */
export default function IndustryNews({ links }: { links: IndustryItem[] }) {
  const [open, setOpen] = useState(false);
  if (!links.length) return null;

  return (
    <>
      <section className="module module-orange w-full max-w-md bg-brand-600 text-white">
        <button onClick={() => setOpen(true)} className="group/head flex items-center gap-2.5 text-left" title="Expand Industry News">
          <Newspaper width={32} height={32} />
          <span className="text-[34px] font-black leading-[0.95] tracking-tight group-hover/head:underline sm:text-[40px]">Industry News</span>
        </button>
        <p className="mb-4 mt-2 text-sm font-semibold text-white/80">Curated links — tap the title to expand</p>
        <div className="industry-scroll max-h-[460px] overflow-y-auto pr-1">
          {links.map((l) => <Row key={l.id} l={l} />)}
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 sm:p-8" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-brand-600 text-white shadow-modal">
            <div className="flex items-center justify-between gap-3 border-b border-white/20 px-6 py-4">
              <h2 className="flex items-center gap-2.5 text-3xl font-black tracking-tight sm:text-4xl"><Newspaper width={30} height={30} /> Industry News</h2>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 hover:bg-white/25" aria-label="Close"><X /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
              {links.map((l) => <Row key={l.id} l={l} big />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
