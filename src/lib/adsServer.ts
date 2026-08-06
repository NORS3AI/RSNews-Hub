import { prisma } from './db';
import { DEFAULT_ADS, pickTwoInArticleAds, adIsLive, type AdRow } from './ads';
import { brandKey } from './entitlements';

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

// An advertiser the composer/module builder can lock a slot to, plus which slot
// shapes it currently has a live creative for. `key` is the normalized brand
// (data-ad-brand stores this), so the client can match without re-normalizing.
export type AdvertiserOption = { key: string; brand: string; wide: boolean; rect: boolean; video: boolean };

/** List every advertiser with at least one live creative, and which slot shapes
 *  each can currently fill. Feeds the ad-slot advertiser picker + its
 *  "no live creative in that size" popup. */
export async function listAdvertisers(): Promise<AdvertiserOption[]> {
  const now = new Date();
  const byKey = new Map<string, AdvertiserOption>();
  for (const a of await loadAds()) {
    if (!adIsLive(a, now)) continue;
    const key = brandKey(a.brand);
    const cur = byKey.get(key) ?? { key, brand: a.brand, wide: false, rect: false, video: false };
    if (a.imageWide) cur.wide = true;
    if (a.imageRect) cur.rect = true;
    if (a.video) cur.video = true;
    byKey.set(key, cur);
  }
  return [...byKey.values()].sort((x, y) => x.brand.localeCompare(y.brand));
}

// Ad slots locked to an advertiser serialize as <div data-ad-slot
// data-ad-brand="<brandKey>" data-ad-size="wide|rectangle">.
const AD_SLOT_RE = /<div\b[^>]*\bdata-ad-slot\b[^>]*>/g;
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] || '';

/** Resolve the advertiser-locked ad slots in an article body to a live creative
 *  each, keyed by "<brandKey>::<size>". Picks a live ad of that advertiser that
 *  actually has the requested shape; an advertiser with nothing live in that
 *  size is omitted so the slot falls back to the Auto smart-cycle. */
export async function loadBrandArticleAds(html: string): Promise<Record<string, AdRow>> {
  const wanted = new Map<string, { brand: string; size: string }>();
  for (const m of (html || '').matchAll(AD_SLOT_RE)) {
    const brand = attr(m[0], 'data-ad-brand');
    if (!brand) continue; // Auto slot — resolved contextually at render time
    const size = attr(m[0], 'data-ad-size') || 'wide';
    wanted.set(`${brand}::${size}`, { brand, size });
  }
  if (!wanted.size) return {};
  const now = new Date();
  const live = (await loadAds()).filter((a) => adIsLive(a, now));
  const map: Record<string, AdRow> = {};
  for (const [key, { brand, size }] of wanted) {
    const brandLive = live.filter((a) => brandKey(a.brand) === brand);
    if (!brandLive.length) continue; // advertiser has nothing live → slot falls back to Auto
    // Prefer a creative that actually fits the chosen shape; otherwise still show
    // this advertiser (a text ad renders fine in any slot) rather than abandon the lock.
    const fits = (a: AdRow) => size === 'rectangle' ? (!!a.imageRect || !!a.video) : !!a.imageWide;
    map[key] = brandLive.find(fits) || brandLive[0];
  }
  return map;
}
