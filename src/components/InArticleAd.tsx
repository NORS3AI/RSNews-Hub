import type { AdRow } from '@/lib/ads';
import AdSlot from '@/components/AdSlot';
import VideoAd from '@/components/site/VideoAd';

/**
 * Presentational house ad shown inside an article. The `ad` is already chosen
 * (server-side) so it never competes with a brand the article discusses — see
 * lib/ads + lib/adsServer. Renders an image creative when the ad has one for
 * this slot (wide banner for in-article, rectangle for the bottom), otherwise a
 * text card. No hooks or DB access, so it's safe on server or client. Falls
 * back to the neutral placeholder when no safe ad is available.
 */
export default function InArticleAd({
  ad, slot, size = 'in-article', tone = 'card', fill = false,
}: { ad: AdRow | null; slot?: string; size?: 'in-article' | 'rectangle'; tone?: 'card' | 'orange'; fill?: boolean }) {
  // `fill` drops the rectangle's max-width cap so the ad fills its column
  // (used on the homepage grid) instead of floating centered at its native size.
  if (!ad) return <AdSlot size={size} slot={slot} className={fill ? 'max-w-none' : undefined} />;

  const rect = size === 'rectangle';
  // A video creative is silent/looping and only fits the rectangle slot.
  if (rect && ad.video) {
    return <VideoAd id={ad.id} href={ad.href} brand={ad.brand} slot={slot} src={ad.video} poster={ad.videoPoster} accent={ad.accent} />;
  }
  const image = rect ? (ad.imageRect || ad.imageWide) : (ad.imageWide || ad.imageRect);
  const orange = tone === 'orange';

  // Analytics: separate placement (slot) / creative (ad id) / campaign (brand)
  // identifiers + format + shape, so the same ad can be compared across slots.
  const trk = {
    'data-trk-type': 'ad',
    'data-trk-id': ad.id,
    'data-trk-place': slot,
    'data-trk-props': JSON.stringify({ brand: ad.brand, campaignId: ad.brand, creativeId: ad.id, format: image ? 'image' : 'text', shape: rect ? 'rectangle' : 'banner' }),
  } as const;

  // Image creative — render the artwork with a small "Ad" chip. On the homepage
  // the card is orange and pads the art into a frame; in-article stays neutral.
  if (image) {
    return (
      <a
        href={ad.href}
        data-ad-slot={slot}
        data-ad-brand={ad.brand}
        {...trk}
        aria-label={`Advertisement: ${ad.brand}`}
        className={`relative mx-auto block w-full overflow-hidden ${orange ? 'ad-orange rounded-2xl bg-brand-600 p-2' : 'rounded-xl border border-[var(--border)] bg-[var(--card)]'} ${rect && !fill ? 'max-w-[360px]' : ''}`}
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <span className="absolute left-3 top-3 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">Ad</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={ad.brand} className={`block w-full ${orange ? 'rounded-lg' : ''}`} />
      </a>
    );
  }

  return (
    <div
      data-ad-slot={slot}
      data-ad-brand={ad.brand}
      {...trk}
      aria-label="Advertisement"
      className={`mx-auto w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] ${rect && !fill ? 'max-w-[340px]' : ''}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="h-1" style={{ background: ad.accent }} />
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white" style={{ background: ad.accent }}>Ad</span>
          <span className="text-xs font-bold text-[var(--fg)]">{ad.brand}</span>
          {ad.label && <span className="ml-auto text-[11px] text-[var(--muted)]">{ad.label}</span>}
        </div>
        <p className="text-[15px] font-semibold leading-snug text-[var(--fg)]">{ad.headline}</p>
        <a href={ad.href} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-white" style={{ background: ad.accent }}>
          {ad.cta} →
        </a>
      </div>
    </div>
  );
}
