// Smart in-article ads.
//
// The one place we must never show a competitor's ad is *inside* an article:
// an article about PostalMate must never carry a ShipRite ad. Each ad declares
// the competitor keywords it must never appear alongside (`competitors`). If
// any of those terms appears in the article, the ad is suppressed there. An
// ad's own brand terms (`keywords`) mark it as contextually relevant so it can
// be preferred on an on-topic article. Advertisers are managed in the admin
// (Ad management) and stored in the `Ad` table; DEFAULT_ADS below seeds them
// and is also the fallback when none are configured.

export type AdRow = {
  id: string;
  brand: string;
  label: string | null;
  headline: string;
  cta: string;
  href: string;
  accent: string;
  keywords: string;      // comma-separated own-brand terms
  competitors: string;   // comma-separated rival terms — hide this ad if any appear in the article
  imageWide?: string | null; // wide banner creative (~3:1) for the in-article slot
  imageRect?: string | null; // rectangle creative (~1.2:1) for the bottom slot
  imageTall?: string | null; // tall skyscraper creative (~1:3) for a vertical module slot
  video?: string | null;     // silent looping video creative (mp4/webm) for the rectangle slot
  videoPoster?: string | null; // poster shown before play / under reduced-motion
  active: boolean;
  house?: boolean;           // RS-owned house ad — the ONLY safe lock fallback
  reserved?: boolean;        // one-off hand-picked creative; never in rotation
  // Optional self-scheduling window for a manually-added (non-flighted) ad, so a
  // one-off outside advertiser can go live/come down on a date without a full
  // campaign. Both null = always-on (a house ad for our own brands). Ignored for
  // flighted ads (the flight is their schedule).
  liveFrom?: Date | string | null;
  liveUntil?: Date | string | null;
  // Flight (paid vendor inventory). House ads have no flight and serve while
  // active; a flighted ad is live only when its flight is SCHEDULED and now is
  // inside the window — so it auto-comes-down at the flight's end.
  flightId?: string | null;
  flightIndex?: number | null;       // 1-based batch number within the campaign
  flightStatus?: string | null;      // 'SCHEDULED' | 'AWAITING' | 'REVIEW' | 'ENDED'
  flightStartAt?: Date | string | null;
  flightEndAt?: Date | string | null;
};

// Article context an in-article ad carries into analytics, so an ad impression/
// click can be attributed to the specific article it ran in — and flagged when
// that article is a vendor-connected sponsored piece. Threaded from the reader
// (page + modal) down to InArticleAd, which folds it into the tracked props.
export type AdContext = { articleId?: string | null; articleSlug?: string | null; sponsored?: boolean };

/** Whether an ad may be served right now: house ad (active) vs flighted-in-window. Pure. */
export function adIsLive(ad: AdRow, now: Date): boolean {
  if (ad.flightId) {
    if (ad.flightStatus !== 'SCHEDULED' || !ad.flightStartAt || !ad.flightEndAt) return false;
    const t = now.getTime();
    return t >= new Date(ad.flightStartAt).getTime() && t < new Date(ad.flightEndAt).getTime();
  }
  if (!ad.active) return false;
  // Non-flighted ad: honor its optional self-scheduling window (blank = always on).
  const t = now.getTime();
  if (ad.liveFrom && t < new Date(ad.liveFrom).getTime()) return false;
  if (ad.liveUntil && t >= new Date(ad.liveUntil).getTime()) return false;
  return true;
}

export const DEFAULT_ADS: AdRow[] = [
  { id: 'seed-packagehub', brand: 'PackageHub', label: 'Pack & ship network',
    headline: 'PackageHub Business Centers — solutions for independent pack & ship stores.',
    cta: 'Learn more', href: '#', accent: '#1f3a5f',
    keywords: 'PackageHub, package hub, pack and ship, pack & ship, pack-and-ship',
    competitors: 'PostalMate, postal mate, ShipRite, ship rite, ship-rite, Stamps.com, Endicia',
    imageWide: '/ads/packagehub-banner.png', imageRect: '/ads/packagehub-rect.png', active: true },
  { id: 'seed-packwise', brand: 'PackWise', label: 'Packing supplies',
    headline: 'PackWise — bubble wrap, tape, labels and everything to pack, ship and deliver with confidence.',
    cta: 'Shop now', href: '#', accent: '#4e8a2e',
    keywords: 'PackWise, packing supplies, bubble wrap, packing tape, shipping labels',
    competitors: 'Uline, Fast-Pack',
    imageWide: '/ads/packwise-banner.png', imageRect: '/ads/packwise-rect.png', active: true },
  { id: 'seed-printpilot', brand: 'PrintPilot', label: 'Printing',
    headline: 'PrintPilot Solutions — business cards, flyers, labels, signs & more. Print smarter, promote better.',
    cta: 'Get started', href: '#', accent: '#6b2fb3',
    keywords: 'PrintPilot, printing, business cards, flyers, brochures, signs, banners',
    competitors: 'Vistaprint, FedEx Office, Staples Print, Office Depot',
    imageWide: '/ads/printpilot-banner.png', imageRect: '/ads/printpilot-rect.png', active: true },
  { id: 'seed-postalmate', brand: 'PostalMate', label: 'Shipping & POS software',
    headline: 'PostalMate — all-in-one shipping, POS & mailbox management for retail counters.',
    cta: 'Start free trial', href: '#', accent: '#2f6f4f',
    keywords: 'PostalMate, postal mate', competitors: 'ShipRite, ship rite, ship-rite, Stamps.com, Endicia', active: true },
  { id: 'seed-shiprite', brand: 'ShipRite', label: 'Shipping software',
    headline: 'ShipRite — multi-carrier shipping and store management, built for pack-and-ship stores.',
    cta: 'Book a demo', href: '#', accent: '#2b5a86',
    keywords: 'ShipRite, ship rite, ship-rite', competitors: 'PostalMate, postal mate, Stamps.com, Endicia', active: true },
  { id: 'seed-stripe', brand: 'Stripe', label: 'Payments',
    headline: 'Stripe — accept payments and grow revenue with a few lines of code.',
    cta: 'Get started', href: '#', accent: '#5a54d6',
    keywords: 'Stripe', competitors: 'Square, PayPal, Adyen, Braintree', active: true },
  { id: 'seed-rsnews-pro', brand: 'RSNews Pro', label: 'RS News Hub',
    headline: 'Read faster with RSNews Pro — ad-free articles, offline clippings, and daily digests.',
    cta: 'Upgrade', href: '#', accent: '#E97D34', keywords: '', competitors: '',
    // House skyscraper creative — the safe fallback for any tall (vertical) ad
    // slot until a paying advertiser uploads their own, so a column skyscraper
    // never collapses to empty. house:true keeps it competitor-safe everywhere.
    imageTall: '/ads/rsnews-pro-tall.svg', active: true, house: true },
  { id: 'seed-clouddesk', brand: 'CloudDesk', label: 'Support software',
    headline: 'CloudDesk — the helpdesk your team will actually enjoy using.',
    cta: 'Try it free', href: '#', accent: '#2b7a8c', keywords: '', competitors: '', active: true },
  { id: 'seed-brewcrate', brand: 'BrewCrate', label: 'Coffee club',
    headline: 'BrewCrate — freshly-roasted specialty coffee, delivered to your desk monthly.',
    cta: 'Shop now', href: '#', accent: '#8a5a2b', keywords: '', competitors: '', active: true },
  { id: 'seed-ledgerlite', brand: 'LedgerLite', label: 'Accounting',
    headline: 'LedgerLite — simple bookkeeping and invoicing for small businesses.',
    cta: 'Learn more', href: '#', accent: '#4a6b8a', keywords: '', competitors: '', active: true },
];

function terms(s: string): string[] {
  return (s || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function normalize(text: string): string {
  return ' ' + (text || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
}

function mentions(hay: string, term: string): boolean {
  return hay.includes(' ' + term + ' ') || hay.includes(' ' + term + '.') || hay.includes(' ' + term + ',');
}

/** True if none of the ad's competitor terms appear in the article text. */
export function adIsSafe(ad: AdRow, hay: string): boolean {
  return !terms(ad.competitors).some((t) => mentions(hay, t));
}
/** True if any of the ad's own brand terms appear (contextually relevant). */
export function adIsRelevant(ad: AdRow, hay: string): boolean {
  return terms(ad.keywords).some((t) => mentions(hay, t));
}

// Deterministic seed from a string so the same slot on the same article always
// picks the same ad (no server/client hydration mismatch, no flicker).
function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Pick a safe ad for an in-article slot from the given inventory.
 * - Never an ad whose competitor is named in the article.
 * - Prefers an ad relevant to the article (its own brand is mentioned).
 * - Otherwise a neutral ad (no keywords and no competitors).
 */
export function pickInArticleAd(ads: AdRow[], articleText: string, slotSeed: string, now: Date = new Date(), favorBrand = '', safeText?: string, lockBrand = ''): AdRow | null {
  const hay = normalize(articleText);
  // Competitor suppression checks the article's TAGS (curated business names) when
  // provided — precise, no body-text false positives. Relevance still uses the
  // full text so an ad can be surfaced on-topic. Falls back to `hay` if no tags.
  const safeHay = safeText != null ? normalize(safeText) : hay;
  const safe = ads.filter((a) => adIsLive(a, now) && adIsSafe(a, safeHay));
  if (!safe.length) return null;

  // HARD LOCK (a vendor-connected article, e.g. What's Hot): show ONLY that
  // vendor's creative; if they have none for this slot, fall back to a true RS
  // house ad (our own brands — no flight, no schedule window). NEVER another
  // advertiser, so a competitor can never appear in a vendor's article.
  const lock = lockBrand.trim().toLowerCase();
  if (lock) {
    const mine = safe.filter((a) => a.brand.trim().toLowerCase() === lock);
    if (mine.length) return mine[seedFrom(slotSeed) % mine.length];
    // Fallback is EXPLICIT house ads only (a.house) — never "no flight/schedule",
    // because an always-on outside advertiser has neither and would be a rival.
    // If no house ad is on file, the slot collapses (null) rather than risk one.
    const house = safe.filter((a) => a.house);
    if (house.length) return house[seedFrom(slotSeed) % house.length];
    return null;
  }

  // Preference order:
  //  1. the VISITING VENDOR's own live ads (favorBrand) — show them their brand,
  //  2. paid (flighted) vendor inventory over house ads,
  //  3. within each tier, an ad relevant to the article's topic.
  // Falls back gracefully to any safe live ad.
  const brand = favorBrand.trim().toLowerCase();
  const favored = brand ? safe.filter((a) => a.brand.trim().toLowerCase() === brand) : [];
  if (favored.length) return favored[seedFrom(slotSeed) % favored.length];

  const paid = safe.filter((a) => a.flightId);
  const rel = (pool: AdRow[]) => pool.filter((a) => adIsRelevant(a, hay));
  const pool = rel(paid).length ? rel(paid) : paid.length ? paid : rel(safe).length ? rel(safe) : safe;

  return pool[seedFrom(slotSeed) % pool.length];
}

// True if two ads are competitors of each other (so they must not share an
// article). Used to keep the top and bottom slots from being rivals.
export function adsAreRivals(a: AdRow, b: AdRow): boolean {
  if (a.id === b.id || a.brand.toLowerCase() === b.brand.toLowerCase()) return true;
  const aTerms = [a.brand.toLowerCase(), ...terms(a.keywords)];
  const bTerms = [b.brand.toLowerCase(), ...terms(b.keywords)];
  const aComp = terms(a.competitors), bComp = terms(b.competitors);
  return aComp.some((t) => bTerms.includes(t)) || bComp.some((t) => aTerms.includes(t));
}

/** Pick the two in-article ads (top + bottom); the bottom is never a rival of the top. */
export function pickTwoInArticleAds(ads: AdRow[], articleText: string, prefix: string, now: Date = new Date(), favorBrand = '', safeText?: string, lockBrand = '') {
  const top = pickInArticleAd(ads, articleText, `${prefix}-top`, now, favorBrand, safeText, lockBrand);
  // When locked to a vendor we WANT the same vendor in both slots, so don't apply
  // the same-brand rivalry exclusion (which would otherwise push the bottom to a
  // house ad). Unlocked, the bottom is still kept off a rival of the top.
  const rest = top && !lockBrand ? ads.filter((a) => !adsAreRivals(a, top)) : ads;
  const bottom = pickInArticleAd(rest, articleText, `${prefix}-bottom`, now, favorBrand, safeText, lockBrand);
  return { top, bottom };
}
