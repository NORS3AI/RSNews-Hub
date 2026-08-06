'use client';
import { useState } from 'react';
import InArticleAd from '@/components/InArticleAd';
import { Clock, Eye } from '@/components/icons';
import type { AdRow } from '@/lib/ads';

// The vendor's own "here's your ad in the Hub" preview: their live creatives
// dropped into the real article + homepage slot components, in whichever theme
// they pick. Only their ads appear — every slot is forced to their creatives, so
// there's never a competitor (or anyone else) in the shot.
export default function VendorAdShowcase({ ads, brand }: { ads: AdRow[]; brand: string }) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'rs'>('light');
  if (!ads.length) return null;

  const wide = ads.find((a) => a.imageWide) || ads[0];
  const rect = ads.find((a) => a.imageRect || a.video) || wide;

  const themeBtn = (t: 'light' | 'dark' | 'rs', label: string) => (
    <button key={t} type="button" onClick={() => setTheme(t)}
      className={`rounded-md px-2.5 py-1 text-xs font-bold ${theme === t ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>{label}</button>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-bold">Your ads in the Hub</h2>
          <p className="text-xs text-[var(--muted)]">Exactly how your creatives appear to readers — no other advertiser is shown.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--card-2)] p-0.5">{themeBtn('light', 'Light')}{themeBtn('dark', 'Dark')}{themeBtn('rs', 'RS')}</div>
      </div>

      {/* RS = light palette + RS textures, so it's right even from a dark account. */}
      <div className={theme === 'rs' ? 'light rs' : theme}>
        <div className="space-y-5 bg-[var(--bg)] p-4 sm:p-6">
          {/* In an article */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">In an article</div>
            <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--card)] p-5 text-[var(--fg)] shadow sm:p-7">
              <span className="badge cat-badge" style={{ '--c': '#3d6a8f' } as React.CSSProperties}>Industry News</span>
              <h3 className="mt-3 text-2xl font-black leading-tight">Independent stores post a strong quarter</h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                <span>By RS News</span><span className="flex items-center gap-1"><Clock width={13} height={13} />3 min read</span><span className="flex items-center gap-1"><Eye width={13} height={13} />1,204 views</span>
              </div>
              <p className="mt-4 text-[var(--fg)]">Retailers across the network reported healthy foot traffic and steady shipping volume through the season, with several owners crediting tighter counter workflows.</p>
              <div className="my-5"><InArticleAd ad={wide} slot="vendor-preview-article" size="in-article" /></div>
              <p className="text-[var(--fg)]">The full breakdown of category performance is below, and we&apos;ll keep this post current as more numbers come in.</p>
              <div className="my-5 flex justify-center"><InArticleAd ad={rect} slot="vendor-preview-article-rect" size="rectangle" /></div>
            </div>
          </div>

          {/* On the homepage */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">On the homepage</div>
            <div className="mx-auto max-w-3xl">
              <div className="mx-auto w-full max-w-[760px]"><InArticleAd ad={wide} slot="vendor-preview-home" size="in-article" tone="orange" /></div>
              <div className="mx-auto mt-4 max-w-sm"><InArticleAd ad={rect} slot="vendor-preview-home-rect" size="rectangle" tone="orange" /></div>
            </div>
          </div>
        </div>
      </div>

      <p className="px-4 py-2.5 text-center text-xs text-[var(--muted)] sm:px-5">Previewing {ads.length} live creative{ads.length === 1 ? '' : 's'} for {brand}.</p>
    </div>
  );
}
