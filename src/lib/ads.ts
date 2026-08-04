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
  active: boolean;
};

export const DEFAULT_ADS: AdRow[] = [
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
  { id: 'seed-rsnews-pro', brand: 'RSNews Pro', label: 'RSNews Hub',
    headline: 'Read faster with RSNews Pro — ad-free articles, offline clippings, and daily digests.',
    cta: 'Upgrade', href: '#', accent: '#E97D34', keywords: '', competitors: '', active: true },
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
export function pickInArticleAd(ads: AdRow[], articleText: string, slotSeed: string): AdRow | null {
  const hay = normalize(articleText);
  const active = ads.filter((a) => a.active);
  const safe = active.filter((a) => adIsSafe(a, hay));
  if (!safe.length) return null;

  const relevant = safe.filter((a) => adIsRelevant(a, hay));
  const neutral = safe.filter((a) => !terms(a.keywords).length && !terms(a.competitors).length);
  const pool = relevant.length ? relevant : (neutral.length ? neutral : safe);

  return pool[seedFrom(slotSeed) % pool.length];
}
