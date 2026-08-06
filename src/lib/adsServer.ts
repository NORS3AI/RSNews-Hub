import { prisma } from './db';
import { DEFAULT_ADS, pickTwoInArticleAds, adIsLive, type AdRow } from './ads';

/** Load the ad inventory (DB) with each ad's flight window/status for live
 *  filtering, falling back to the built-in house defaults. */
export async function loadAds(): Promise<AdRow[]> {
  try {
    const rows = await prisma.ad.findMany({
      orderBy: { createdAt: 'asc' },
      include: { flight: { select: { status: true, startAt: true, endAt: true } } },
    });
    if (!rows.length) return DEFAULT_ADS;
    return rows.map((r) => ({
      ...r,
      flightStatus: r.flight?.status ?? null,
      flightStartAt: r.flight?.startAt ?? null,
      flightEndAt: r.flight?.endAt ?? null,
    }));
  } catch {
    return DEFAULT_ADS;
  }
}

/** Pick the two in-article ads (top + bottom) for an article's text. When a
 *  vendor is viewing, `favorBrand` (their own brand) is surfaced first. */
export async function pickArticleAds(context: string, prefix: string, favorBrand = '') {
  const ads = await loadAds();
  return pickTwoInArticleAds(ads, context, prefix, new Date(), favorBrand);
}

// Ad slots the composer pins to a specific ad serialize as data-ad-id="<id>".
const PINNED_AD_ID_RE = /data-ad-id="([^"]+)"/g;

/** Resolve the ads an article's body pins by id (composer "pick a specific ad"),
 *  as an id→ad map. Only currently-live ads are returned; an unknown, paused, or
 *  out-of-flight id is omitted so that slot falls back to an auto-picked ad. */
export async function loadPinnedArticleAds(html: string): Promise<Record<string, AdRow>> {
  const ids = new Set<string>();
  for (const m of (html || '').matchAll(PINNED_AD_ID_RE)) if (m[1]) ids.add(m[1]);
  if (!ids.size) return {};
  const now = new Date();
  const map: Record<string, AdRow> = {};
  for (const ad of await loadAds()) if (ids.has(ad.id) && adIsLive(ad, now)) map[ad.id] = ad;
  return map;
}
