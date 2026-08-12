// No-AI search broadening: a small, hand-curated synonym map so a reader can
// search the words THEY know and still find the article. Purely lexical — no
// model, no embeddings — so it's fast, predictable, and fully under your
// control. Add groups as you learn what people actually type.
//
// Each group is a set of interchangeable terms; matching any one also searches
// the others. Bidirectional by construction. Keep entries lowercase.

const SYNONYM_GROUPS: string[][] = [
  ['usps', 'postal', 'post office', 'postal service'],
  ['shipping', 'postage', 'freight', 'parcel', 'delivery'],
  ['carrier', 'ups', 'fedex', 'dhl'],
  ['pos', 'point of sale', 'register', 'checkout'],
  ['mailbox', 'po box', 'box rental'],
  ['store', 'shop', 'retail', 'storefront'],
  ['rate', 'rates', 'pricing', 'price'],
  ['customer', 'client', 'shopper'],
  ['newsletter', 'digest', 'email'],
  ['membership', 'member', 'subscription'],
];

// term -> set of related terms (built once).
const MAP: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      const set = m.get(term) ?? new Set<string>();
      for (const other of group) if (other !== term) set.add(other);
      m.set(term, set);
    }
  }
  return m;
})();

export type WeightedTerm = { term: string; weight: number };

/** Lowercase + strip surrounding punctuation; keep inner spaces (phrases). */
export function normalizeTerm(raw: string): string {
  return raw.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').trim();
}

/**
 * Expand a raw query into weighted search terms: the reader's own words at full
 * weight (1), curated synonyms at half weight (0.5) so exact matches always rank
 * above synonym matches. Deduped, keeping the highest weight per term.
 */
export function expandQuery(query: string, maxTerms = 8): WeightedTerm[] {
  const originals = (query || '')
    .split(/\s+/)
    .map(normalizeTerm)
    .filter(Boolean)
    .slice(0, maxTerms);

  const weights = new Map<string, number>();
  const bump = (term: string, w: number) => {
    const cur = weights.get(term);
    if (cur === undefined || w > cur) weights.set(term, w);
  };

  for (const t of originals) {
    bump(t, 1);
    for (const syn of MAP.get(t) ?? []) bump(syn, 0.5);
  }
  return [...weights.entries()].map(([term, weight]) => ({ term, weight }));
}
