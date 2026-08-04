// Smart in-article ads.
//
// The one place we must never show a competitor's ad is *inside* an article:
// an article about PostalMate must never carry a ShipRite ad, and vice-versa.
// Every ad belongs to a competitive "group" (a vertical). Before an ad is
// shown in an article we scan the article text for brands; any ad whose group
// is represented in the article by a *different* brand is dropped. Neutral
// house ads (no group) are always safe and fill everything else.

export type Brand = { name: string; group: string; aliases: string[] };
export type HouseAd = {
  id: string;
  brand: string;
  group: string | null; // competitive vertical; null = neutral house ad, safe anywhere
  label: string;        // e.g. "Shipping & POS software"
  headline: string;
  cta: string;
  href: string;
  accent: string;       // hex accent for the card
};

// Brands we recognise in article copy, grouped by competitive vertical.
export const BRANDS: Brand[] = [
  { name: 'PostalMate', group: 'shipping-software', aliases: ['postalmate', 'postal mate'] },
  { name: 'ShipRite', group: 'shipping-software', aliases: ['shiprite', 'ship-rite', 'ship rite'] },
  { name: 'Stamps.com', group: 'shipping-software', aliases: ['stamps.com', 'stamps .com'] },
  { name: 'Endicia', group: 'shipping-software', aliases: ['endicia'] },
  { name: 'AWS', group: 'cloud', aliases: ['aws', 'amazon web services'] },
  { name: 'Azure', group: 'cloud', aliases: ['azure', 'microsoft azure'] },
  { name: 'Google Cloud', group: 'cloud', aliases: ['google cloud', 'gcp'] },
  { name: 'Stripe', group: 'payments', aliases: ['stripe'] },
  { name: 'Square', group: 'payments', aliases: ['square payments', 'square pos'] },
  { name: 'PayPal', group: 'payments', aliases: ['paypal'] },
];

// House ad inventory. Brand ads carry a group (so they conflict); the neutral
// house ads (group: null) are safe in any article and cover everything else.
export const HOUSE_ADS: HouseAd[] = [
  { id: 'postalmate', brand: 'PostalMate', group: 'shipping-software', label: 'Shipping & POS software',
    headline: 'PostalMate — all-in-one shipping, POS & mailbox management for retail counters.',
    cta: 'Start free trial', href: '#', accent: '#2f6f4f' },
  { id: 'shiprite', brand: 'ShipRite', group: 'shipping-software', label: 'Shipping software',
    headline: 'ShipRite — multi-carrier shipping and store management, built for pack-and-ship stores.',
    cta: 'Book a demo', href: '#', accent: '#2b5a86' },
  { id: 'stripe', brand: 'Stripe', group: 'payments', label: 'Payments',
    headline: 'Stripe — accept payments and grow revenue with a few lines of code.',
    cta: 'Get started', href: '#', accent: '#5a54d6' },

  // Neutral house ads — no competitive group, safe in any article.
  { id: 'rsnews-pro', brand: 'RSNews Pro', group: null, label: 'RSNews Hub',
    headline: 'Read faster with RSNews Pro — ad-free articles, offline clippings, and daily digests.',
    cta: 'Upgrade', href: '#', accent: '#E97D34' },
  { id: 'clouddesk', brand: 'CloudDesk', group: null, label: 'Support software',
    headline: 'CloudDesk — the helpdesk your team will actually enjoy using.',
    cta: 'Try it free', href: '#', accent: '#2b7a8c' },
  { id: 'brewcrate', brand: 'BrewCrate', group: null, label: 'Coffee club',
    headline: 'BrewCrate — freshly-roasted specialty coffee, delivered to your desk monthly.',
    cta: 'Shop now', href: '#', accent: '#8a5a2b' },
  { id: 'ledgerlite', brand: 'LedgerLite', group: null, label: 'Accounting',
    headline: 'LedgerLite — simple bookkeeping and invoicing for small businesses.',
    cta: 'Learn more', href: '#', accent: '#4a6b8a' },
];

export type Mention = { group: string; brand: string };

function normalize(s: string): string {
  return ' ' + (s || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
}

/** Which known brands does this article text mention? */
export function detectBrandMentions(text: string): Mention[] {
  const hay = normalize(text);
  const out: Mention[] = [];
  for (const b of BRANDS) {
    if (b.aliases.some((a) => hay.includes(' ' + a + ' ') || hay.includes(' ' + a + '.') || hay.includes(' ' + a + ','))) {
      out.push({ group: b.group, brand: b.name });
    }
  }
  return out;
}

/** An ad conflicts if its vertical appears in the article via a rival brand. */
export function adConflicts(ad: HouseAd, mentions: Mention[]): boolean {
  if (!ad.group) return false;
  return mentions.some((m) => m.group === ad.group && m.brand.toLowerCase() !== ad.brand.toLowerCase());
}

// Deterministic seed from a string so the same slot on the same article always
// picks the same ad (no server/client hydration mismatch, no flicker).
function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Pick a safe house ad for an in-article slot.
 * - Never a competitor of a brand named in the article.
 * - Prefers an ad for a brand the article actually mentions (relevant).
 * - Otherwise a neutral house ad.
 */
export function pickInArticleAd(articleText: string, slotSeed: string): HouseAd | null {
  const mentions = detectBrandMentions(articleText);
  const safe = HOUSE_ADS.filter((ad) => !adConflicts(ad, mentions));
  if (!safe.length) return null;

  const relevant = safe.filter((ad) => ad.group && mentions.some((m) => m.group === ad.group && m.brand.toLowerCase() === ad.brand.toLowerCase()));
  const neutral = safe.filter((ad) => !ad.group);
  const pool = relevant.length ? relevant : (neutral.length ? neutral : safe);

  return pool[seedFrom(slotSeed) % pool.length];
}
