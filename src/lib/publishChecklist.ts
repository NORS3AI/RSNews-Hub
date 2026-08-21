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

export type Flag = { level: 'warn' | 'info'; text: string };

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
      flags.push({ level: 'warn', text: `The top byline is “${input.bylineName}”, but an in-article Author card says “${cardName}”. Confirm they should differ.` });
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
