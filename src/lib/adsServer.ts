import { prisma } from './db';
import { DEFAULT_ADS, pickTwoInArticleAds, adIsLive, type AdRow } from './ads';
import { brandKey } from './entitlements';

// A lock value no real brandKey can equal. Used when an article is connected to a
// vendor (sponsorVendorId set) but that vendor no longer resolves — the link has
// no FK by design, so a deleted/merged vendor leaves the id dangling. Without this
// sentinel the lockBrand would be '' and every guard would read it as "no lock",
// re-admitting competitors. With it, the hard-lock stays ON and matches nothing →
// house-only / collapse, never a rival.
export const UNRESOLVED_LOCK = '__unresolved_vendor__';

/** Resolve the in-article ad lock for an article, identically for the full page
 *  and the reader-modal API. '' → not connected (no lock); a brandKey → lock to
 *  that vendor; UNRESOLVED_LOCK → connected but the vendor is gone (lock to
 *  nothing so only house ads / collapse can fill a slot). */
export async function resolveArticleLockBrand(sponsorVendorId: string | null | undefined): Promise<string> {
  if (!sponsorVendorId) return '';
  const v = await prisma.vendor.findUnique({ where: { id: sponsorVendorId }, select: { name: true } });
  return brandKey(v?.name || '') || UNRESOLVED_LOCK;
}

/** Load the ad inventory (DB) with each ad's flight window/status for live
 *  filtering, falling back to the built-in house defaults. Competitor groups
 *  (admin-defined) are folded into every member ad's competitor terms, so an
 *  article that names one group member suppresses the others in every slot. */
export async function loadAds(): Promise<AdRow[]> {
  try {
    const [rows, groups] = await Promise.all([
      prisma.ad.findMany({
        // Reserved one-off creatives are hand-placed only — never in the rotation.
        where: { reserved: false },
        orderBy: { createdAt: 'asc' },
        include: { flight: { select: { index: true, status: true, startAt: true, endAt: true } } },
      }),
      loadCompetitorGroups(),
    ]);
    if (!rows.length) return DEFAULT_ADS;
    return rows.map((r) => {
      const key = brandKey(r.brand);
      // Brands grouped with this ad's brand become its competitors too.
      const mates = new Set<string>();
      for (const g of groups) if (g.includes(key)) g.forEach((k) => { if (k !== key) mates.add(k); });
      const competitors = [r.competitors, ...mates].filter(Boolean).join(', ');
      return {
        ...r,
        competitors,
        flightIndex: r.flight?.index ?? null,
        flightStatus: r.flight?.status ?? null,
        flightStartAt: r.flight?.startAt ?? null,
        flightEndAt: r.flight?.endAt ?? null,
      };
    });
  } catch {
    return DEFAULT_ADS;
  }
}

/** Competitor groups as arrays of normalized brand keys. */
export async function loadCompetitorGroups(): Promise<string[][]> {
  try {
    const rows = await prisma.competitorGroup.findMany({ select: { brands: true } });
    return rows
      .map((r) => r.brands.split(',').map((s) => brandKey(s)).filter(Boolean))
      .filter((g) => g.length > 1);
  } catch {
    return [];
  }
}

/** Pick the two in-article ads (top + bottom) for an article's text. When a
 *  vendor is viewing, `favorBrand` (their own brand) is surfaced first. */
export async function pickArticleAds(context: string, prefix: string, favorBrand = '', safeContext?: string, lockBrand = '') {
  const ads = await loadAds();
  return pickTwoInArticleAds(ads, context, prefix, new Date(), favorBrand, safeContext, lockBrand);
}

// An advertiser the composer/module builder can lock a slot to, plus which slot
// shapes it currently has a live creative for. `key` is the normalized brand
// (data-ad-brand stores this), so the client can match without re-normalizing.
export type AdvertiserOption = { key: string; brand: string; wide: boolean; rect: boolean; video: boolean; tall: boolean };

/** List every advertiser with at least one live creative, and which slot shapes
 *  each can currently fill. Feeds the ad-slot advertiser picker + its
 *  "no live creative in that size" popup. */
export async function listAdvertisers(): Promise<AdvertiserOption[]> {
  const now = new Date();
  const byKey = new Map<string, AdvertiserOption>();
  for (const a of await loadAds()) {
    if (!adIsLive(a, now)) continue;
    const key = brandKey(a.brand);
    const cur = byKey.get(key) ?? { key, brand: a.brand, wide: false, rect: false, video: false, tall: false };
    if (a.imageWide) cur.wide = true;
    if (a.imageRect) cur.rect = true;
    if (a.video) cur.video = true;
    if (a.imageTall) cur.tall = true;
    byKey.set(key, cur);
  }
  return [...byKey.values()].sort((x, y) => x.brand.localeCompare(y.brand));
}

// Ad slots locked to an advertiser serialize as <div data-ad-slot
// data-ad-brand="<brandKey>" data-ad-size="wide|rectangle">.
const AD_SLOT_RE = /<div\b[^>]*\bdata-ad-slot\b[^>]*>/g;
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] || '';

// ── Reserved one-off ads (hand-picked into a specific article) ──────────────

/** Reserved creatives, for the editor's "Insert sponsor ad" picker. */
export async function listReservedAds(): Promise<{ id: string; brand: string; headline: string }[]> {
  try {
    return await prisma.ad.findMany({ where: { reserved: true }, orderBy: { createdAt: 'desc' }, select: { id: true, brand: true, headline: true } });
  } catch { return []; }
}

const AD_ID_RE = /data-ad-id="([^"]+)"/g;

/** Resolve `data-ad-id` markers in an article body to the exact ad BY ID. This is
 *  a deliberate hand-pick, so it bypasses the rotation/reserved filter — it's the
 *  one path that can serve a reserved creative. */
export async function resolveReservedArticleAds(html: string, lockBrand = ''): Promise<Record<string, AdRow>> {
  const ids = [...new Set([...(html || '').matchAll(AD_ID_RE)].map((m) => m[1]))];
  if (!ids.length) return {};
  try {
    // reserved:true only — a data-ad-id block is exclusively for a hand-picked
    // reserved sponsor creative. This stops a lower-trust editor from embedding
    // an arbitrary flighted/competitor ad by id (which would bypass the rotation,
    // competitor-suppression, and flight-window logic in loadAds).
    const rows = await prisma.ad.findMany({ where: { id: { in: ids }, reserved: true }, include: { flight: { select: { status: true, startAt: true, endAt: true } } } });
    const lock = lockBrand.trim().toLowerCase();
    const now = new Date();
    const map: Record<string, AdRow> = {};
    for (const r of rows) {
      // On a vendor-connected article, a reserved creative for a DIFFERENT vendor
      // is dropped — only the connected vendor's own reserved ad may appear, so an
      // editor can't embed a competitor's reserved ad by id in their piece.
      if (lock && brandKey(r.brand) !== lock) continue;
      const row: AdRow = { ...r, flightStatus: r.flight?.status ?? null, flightStartAt: r.flight?.startAt ?? null, flightEndAt: r.flight?.endAt ?? null };
      // Honor liveness: a reserved creative the admin has deactivated (or whose
      // optional self-scheduling window has passed) must stop serving.
      if (!adIsLive(row, now)) continue;
      map[r.id] = row;
    }
    return map;
  } catch { return {}; }
}

/** Resolve the advertiser-locked ad slots in an article body to a live creative
 *  each, keyed by "<brandKey>::<size>". Picks a live ad of that advertiser that
 *  actually has the requested shape; an advertiser with nothing live in that
 *  size is omitted so the slot falls back to the Auto smart-cycle. */
export async function loadBrandArticleAds(html: string, lockBrand = ''): Promise<Record<string, AdRow>> {
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
  const lock = lockBrand.trim().toLowerCase();
  // A sold slot must never fall back to another advertiser (a possible competitor).
  // "House" is now the EXPLICIT flag only — never "no flight" (an always-on outside
  // advertiser has no flight and would be a rival). If nothing safe fits, the slot
  // is omitted and falls back to the Auto smart-cycle (which is itself vendor-locked
  // on a connected article).
  const house = live.filter((a) => a.house);
  const map: Record<string, AdRow> = {};
  for (const [key, { brand, size }] of wanted) {
    // On a vendor-connected article, a slot locked to a DIFFERENT advertiser is
    // dropped entirely so it can never show a competitor — it falls to the
    // vendor-locked Auto cycle instead.
    if (lock && brand !== lock) continue;
    const fits = (a: AdRow) => size === 'rectangle' ? (!!a.imageRect || !!a.video) : !!a.imageWide;
    const brandLive = live.filter((a) => brandKey(a.brand) === brand);
    // Prefer a creative that fits the shape; else the advertiser's other creative;
    // else an RS house ad; else Auto (omit).
    const chosen = brandLive.find(fits) || brandLive[0] || house.find(fits) || house[0];
    if (chosen) map[key] = chosen;
  }
  return map;
}
