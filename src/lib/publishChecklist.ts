// Pre-publish checklist — pure logic. The composer gathers the article's settings
// (from the form + the editor body) into a PublishInput; this turns that into a
// short human summary plus any "look twice" flags. No DOM, no React, so the
// conflict rules are testable and can't drift from what the modal shows.

export type AdEntry = {
  index: number;            // 1-based position among ads in the body
  kind: 'slot' | 'reserved';
  size?: string;            // 'wide' | 'rectangle'
  brand: string;            // advertiser lock key ('' = Auto, competitor-safe)
  label: string;            // advertiser display name, if pinned
};

export type PublishInput = {
  title: string;
  bylineName: string;       // resolved display name; '' when the house team default
  publishedAt: string;      // raw datetime-local value ('' = now)
  now: number;              // Date.now(), passed in so the fn stays pure
  primaryCategory: string;  // name, or ''
  extraCategories: string[];// names
  genre: string;            // label, or ''
  tags: string[];
  connectedVendor: string;  // vendor name, or ''
  sponsored: boolean;
  breaking: boolean;
  featured: boolean;
  pinned: boolean;
  ads: AdEntry[];
  authorCards: string[];    // resolved names of in-article Author cards (non-empty only)
};

// 'block' = must be fixed before publishing (the modal disables Confirm);
// 'warn'  = look twice (amber, but publishable); 'info' = a heads-up.
export type Flag = { level: 'block' | 'warn' | 'info'; text: string };

/** True when any flag hard-blocks publishing. */
export function hasBlockingFlag(flags: Flag[]): boolean {
  return flags.some((f) => f.level === 'block');
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Extract the in-article Author cards from rendered article HTML (server-safe,
 *  no DOM). Each card carries a typed-in name and/or a linked library byline id. */
export function authorCardsInHtml(html: string): { name: string; bylineId: string }[] {
  const out: { name: string; bylineId: string }[] = [];
  const tagRe = /<div\b[^>]*\bdata-author\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html || ''))) {
    const tag = m[0];
    const name = decodeEntities(tag.match(/data-name="([^"]*)"/i)?.[1] || '').trim();
    const bylineId = (tag.match(/data-bylineid="([^"]*)"/i)?.[1] || '').trim();
    out.push({ name, bylineId });
  }
  return out;
}

/** Extract the ad slots (and reserved sponsor creatives) from rendered article
 *  HTML, in document order, server-safe. Mirrors the composer's DOM parse. */
export function adSlotsInHtml(html: string): AdEntry[] {
  const out: AdEntry[] = [];
  const re = /<div\b[^>]*\b(?:data-ad-slot|data-ad-id)\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html || ''))) {
    const tag = m[0];
    i += 1;
    const label = decodeEntities(tag.match(/data-ad-label="([^"]*)"/i)?.[1] || '').trim();
    if (/\bdata-ad-id=/i.test(tag)) {
      out.push({ index: i, kind: 'reserved', brand: '', label });
    } else {
      const brand = (tag.match(/data-ad-brand="([^"]*)"/i)?.[1] || '').trim();
      const size = (tag.match(/data-ad-size="([^"]*)"/i)?.[1] || 'wide').trim();
      out.push({ index: i, kind: 'slot', size, brand, label });
    }
  }
  return out;
}

/** The first Author-card name that disagrees with a named top byline, or null when
 *  they're consistent. Used to hard-block a conflicting publish (client + server). */
export function bylineMismatch(topBylineName: string, cardNames: string[]): string | null {
  const top = (topBylineName || '').trim().toLowerCase();
  if (!top) return null; // house-team default never conflicts
  for (const c of cardNames) {
    const cn = (c || '').trim();
    if (cn && cn.toLowerCase() !== top) return cn;
  }
  return null;
}

export type PublishTiming = { kind: 'now' | 'scheduled' | 'backdated'; label: string };

/** How the publish date reads: now, scheduled for the future, or backdated. */
export function describeTiming(publishedAt: string, now: number): PublishTiming {
  const raw = (publishedAt || '').trim();
  if (!raw) return { kind: 'now', label: 'Now' };
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return { kind: 'now', label: 'Now' };
  const label = new Date(raw).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  if (t > now + 60_000) return { kind: 'scheduled', label: `Scheduled — ${label}` };
  if (t < now - 60_000) return { kind: 'backdated', label: `Backdated — ${label}` };
  return { kind: 'now', label };
}

const norm = (s: string) => s.trim().toLowerCase();

/** The "look twice" flags for a publish. Empty = nothing unusual. */
export function publishFlags(input: PublishInput): Flag[] {
  const flags: Flag[] = [];

  // No category → the piece won't surface in any section.
  if (!input.primaryCategory && input.extraCategories.length === 0) {
    flags.push({ level: 'warn', text: 'No category is set — this article won’t appear in any category section.' });
  }

  // Byline (top) vs in-article Author card naming a different person.
  const top = norm(input.bylineName);
  for (const cardName of input.authorCards) {
    const card = norm(cardName);
    if (!card) continue;
    if (top && card !== top) {
      // Hard block: a named top byline and a named Author card that disagree is
      // almost always a mistake — fix it before this can publish.
      flags.push({ level: 'block', text: `The top byline is “${input.bylineName}”, but an in-article Author card says “${cardName}”. Make them the same person before publishing.` });
    } else if (!top && card) {
      flags.push({ level: 'info', text: `The top byline is the house team, but an in-article Author card names “${cardName}”.` });
    }
  }

  // Ads: pinned advertisers, multiple different brands, and vendor-lock mismatch.
  const pinned = input.ads.filter((a) => a.brand || a.kind === 'reserved');
  const brandNames = Array.from(new Set(pinned.map((a) => a.label || a.brand).filter(Boolean)));
  if (brandNames.length > 1) {
    flags.push({ level: 'warn', text: `This article pins ${brandNames.length} different advertisers (${brandNames.join(', ')}). Confirm that’s intended.` });
  }
  if (input.connectedVendor) {
    const v = norm(input.connectedVendor);
    const offVendor = brandNames.filter((b) => norm(b) !== v);
    if (offVendor.length) {
      flags.push({ level: 'warn', text: `The article is vendor-locked to “${input.connectedVendor}”, but an ad pins “${offVendor.join(', ')}”.` });
    }
    // Always ask them to confirm a vendor-specific piece.
    flags.push({ level: 'info', text: `This is a vendor piece locked to “${input.connectedVendor}”. Its in-article ads run that vendor (house fallback). Confirm that’s right.` });
  }

  return flags;
}
