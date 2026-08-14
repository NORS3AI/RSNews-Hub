import type { AdRow, AdContext } from '@/lib/ads';
import AdSlot from '@/components/AdSlot';
import VideoAd from '@/components/site/VideoAd';
import AdExpand from '@/components/site/AdExpand';

/**
 * Presentational house ad shown inside an article. The `ad` is already chosen
 * (server-side) so it never competes with a brand the article discusses — see
 * lib/ads + lib/adsServer. Renders an image creative when the ad has one for
 * this slot (wide banner for in-article, rectangle for the bottom), otherwise a
 * text card. No hooks or DB access, so it's safe on server or client. Falls
 * back to the neutral placeholder when no safe ad is available.
 */
export default function InArticleAd({
  ad, slot, size = 'in-article', tone = 'card', fill = false, placeholder = true, adContext,
}: { ad: AdRow | null; slot?: string; size?: 'in-article' | 'rectangle'; tone?: 'card' | 'orange'; fill?: boolean; placeholder?: boolean; adContext?: AdContext }) {
  // `placeholder=false` means "never show a filler box" — render nothing when
  // there's no image creative to show. Used on the live homepage so a reader
  // never sees an empty ad slot (dashed placeholder OR the orange no-image box);
  // the slot simply collapses. In-article slots keep placeholder=true.
  // `fill` drops the rectangle's max-width cap so the ad fills its column
  // (used on the homepage grid) instead of floating centered at its native size.
  if (!ad) return placeholder ? <AdSlot size={size} slot={slot} className={fill ? 'max-w-none' : undefined} /> : null;

  const rect = size === 'rectangle';
  // A video creative is silent/looping and only fits the rectangle slot.
  if (rect && ad.video) {
    return <VideoAd id={ad.id} href={ad.href} brand={ad.brand} slot={slot} src={ad.video} poster={ad.videoPoster} accent={ad.accent} />;
  }
  const image = rect ? (ad.imageRect || ad.imageWide) : (ad.imageWide || ad.imageRect);
  const orange = tone === 'orange';

  // Analytics: separate placement (slot) / creative (ad id) / campaign (brand)
  // identifiers + format + shape, so the same ad can be compared across slots.
  // When rendered inside an article we also carry the article id/slug + a
  // `sponsored` flag, so an ad event is attributable to the exact (sponsored)
  // article it ran in — see AnalyticsProvider → advertiserReport.bySponsoredArticle.
  // A flighted (paid) ad also carries its batch identity (the AdFlight = one
  // campaign batch), so a vendor's performance can be split per batch — evergreen
  // house ads have no flight, so they carry none (correctly excluded from batches).
  const trkProps = {
    brand: ad.brand, campaignId: ad.brand, creativeId: ad.id,
    format: image ? 'image' : 'text', shape: rect ? 'rectangle' : 'banner',
    ...(ad.flightId ? { flightId: ad.flightId, flightIndex: ad.flightIndex ?? null } : {}),
    ...(adContext?.articleId ? { articleId: adContext.articleId } : {}),
    ...(adContext?.articleSlug ? { articleSlug: adContext.articleSlug } : {}),
    ...(adContext?.sponsored ? { sponsored: true } : {}),
  };
  const trk = {
    'data-trk-type': 'ad',
    'data-trk-id': ad.id,
    'data-trk-place': slot,
    'data-trk-props': JSON.stringify(trkProps),
  } as const;

  // Image creative — render the artwork with a small "Ad" chip. On the homepage
  // the card is orange and pads the art into a frame; in-article stays neutral.
  // A small zoom button (AdExpand) sits outside the anchor so tapping it enlarges
  // the ad instead of navigating.
  if (image) {
    return (
      <div className={`relative mx-auto w-full ${rect && !fill ? 'max-w-[360px]' : ''}`}>
        <a
          href={ad.href}
          data-ad-slot={slot}
          data-ad-brand={ad.brand}
          {...trk}
          aria-label={`Advertisement: ${ad.brand}`}
          className={`relative block w-full overflow-hidden ${orange ? 'ad-orange rounded-2xl bg-brand-600 p-2' : 'rounded-xl border border-[var(--border)] bg-[var(--card)]'}`}
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <span className="absolute left-3 top-3 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">Ad</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={ad.brand} className={`block w-full ${orange ? 'rounded-lg' : ''}`} />
        </a>
        <AdExpand kind="image" brand={ad.brand} href={ad.href} cta={ad.cta} subjectId={ad.id} placement={slot} trkProps={trkProps} src={image} />
      </div>
    );
  }

  // No image creative on file for this slot. On surfaces that opt out of fillers
  // (the live homepage) collapse to nothing rather than show an empty box.
  if (!placeholder) return null;
  // Otherwise (in-article): we don't run word ads — show a themed, correctly-
  // shaped placeholder (a horizontal banner for the in-article slot, a rectangle
  // for the bottom slot) in the site's orange, awaiting the advertiser's image.
  return (
    <div className={`mx-auto w-full ${rect && !fill ? 'max-w-[340px]' : ''}`}>
      <div
        data-ad-slot={slot}
        data-ad-brand={ad.brand}
        {...trk}
        aria-label={`Advertisement: ${ad.brand}`}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-6 text-center text-white ${rect ? 'min-h-[250px]' : 'min-h-[140px]'}`}
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">Ad</span>
        <span className="text-base font-extrabold">{ad.brand}</span>
        {ad.label && <span className="text-[11px] font-medium text-white/80">{ad.label}</span>}
      </div>
    </div>
  );
}
