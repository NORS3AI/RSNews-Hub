'use client';
import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics/track';

// Silent, looping video ad creative for the rectangle slot. It:
//  - autoplays MUTED (the only kind browsers allow) and only while on-screen,
//    pausing when scrolled away to save data/CPU;
//  - honors prefers-reduced-motion (shows the poster, no motion);
//  - is a link — a click visits the advertiser (impression + click come from the
//    same data-trk-* attributes image ads use, via AnalyticsProvider);
//  - reports playback quartiles (start/25/50/75/100) ONCE per impression, so the
//    dashboard can show completion, not just views.

type Props = {
  id: string; href: string; brand: string; slot?: string;
  src: string; poster?: string | null; accent: string;
};

const QUARTILES = [25, 50, 75, 100] as const;

export default function VideoAd({ id, href, brand, slot, src, poster, accent }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fired = useRef<Set<number>>(new Set());

  const fire = (quartile: number) => {
    if (fired.current.has(quartile)) return;
    fired.current.add(quartile);
    track({ type: 'video', subjectType: 'ad', subjectId: id, placement: slot,
      props: { quartile, brand, campaignId: brand, creativeId: id, format: 'video', shape: 'rectangle' } });
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const onPlay = () => fire(0); // a playback (view) started
    const onTime = () => {
      if (!el.duration || !isFinite(el.duration)) return;
      const pct = (el.currentTime / el.duration) * 100;
      for (const q of QUARTILES) if (pct >= (q === 100 ? 99 : q)) fire(q);
    };
    el.addEventListener('play', onPlay);
    el.addEventListener('timeupdate', onTime);

    // Play only while at least half in view; never under reduced-motion.
    let io: IntersectionObserver | null = null;
    if (!reduce && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && e.intersectionRatio >= 0.5) el.play().catch(() => {});
            else el.pause();
          }
        },
        { threshold: [0, 0.5, 1] },
      );
      io.observe(el);
    }
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('timeupdate', onTime);
      io?.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <a
      href={href}
      data-ad-slot={slot}
      data-ad-brand={brand}
      data-trk-type="ad"
      data-trk-id={id}
      data-trk-place={slot}
      data-trk-props={JSON.stringify({ brand, campaignId: brand, creativeId: id, format: 'video', shape: 'rectangle' })}
      aria-label={`Advertisement: ${brand}`}
      className="relative mx-auto block w-full max-w-[360px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <span className="absolute left-3 top-3 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">Ad</span>
      <span className="absolute right-3 top-3 z-10 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90" aria-hidden>▶ Muted</span>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        className="block w-full"
        style={{ background: accent }}
      />
    </a>
  );
}
