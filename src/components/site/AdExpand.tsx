'use client';
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics/track';
import { Maximize, X } from '@/components/icons';

// A small "expand" affordance shown on every ad. Tapping it opens the creative
// larger in an overlay so a reader can actually read fine print — and records an
// `ad_expand` event (a readability signal: a high expand rate means the ad is
// too small at its placed size). The overlay's "Visit advertiser" link carries
// the same data-trk-* attributes as the ad, so a click there still counts as a
// normal ad click via AnalyticsProvider.

type Props = {
  kind: 'image' | 'video' | 'text';
  brand: string;
  href: string;
  cta?: string;
  subjectId: string;
  placement?: string;
  trkProps: Record<string, unknown>;
  src?: string;              // image or video source
  poster?: string | null;    // video poster
  headline?: string;         // text-card ads
  accent?: string;
};

export default function AdExpand({ kind, brand, href, cta, subjectId, placement, trkProps, src, poster, headline, accent }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [open]);

  function expand() {
    track({ type: 'ad_expand', subjectType: 'ad', subjectId, placement, props: trkProps });
    setOpen(true);
  }

  const trk = {
    'data-trk-type': 'ad', 'data-trk-id': subjectId, 'data-trk-place': placement,
    'data-trk-props': JSON.stringify(trkProps),
  } as const;

  return (
    <>
      <button
        type="button" onClick={expand} aria-label={`Enlarge ${brand} ad`} title="Enlarge"
        className="absolute bottom-2 right-2 z-20 grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        <Maximize width={15} height={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-8 animate-fade-in" role="dialog" aria-modal="true" aria-label={`${brand} advertisement`} onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" />
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25" aria-label="Close"><X /></button>

          <div className="relative z-10 flex max-h-[94dvh] w-auto max-w-4xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/90">Advertisement</span>

            {kind === 'image' && src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={brand} className="max-h-[78dvh] w-auto max-w-full rounded-xl shadow-modal" />
            )}
            {kind === 'video' && src && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={src} poster={poster || undefined} controls autoPlay loop playsInline className="max-h-[78dvh] w-auto max-w-full rounded-xl shadow-modal" style={{ background: accent }} />
            )}
            {kind === 'text' && (
              <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 text-center shadow-modal">
                <div className="text-sm font-black uppercase tracking-wide" style={{ color: accent }}>{brand}</div>
                <p className="mt-2 text-2xl font-extrabold leading-snug text-[var(--fg)]">{headline}</p>
              </div>
            )}

            <a href={href} {...trk} aria-label={`Visit advertiser: ${brand}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
              {cta || 'Visit advertiser'} →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
