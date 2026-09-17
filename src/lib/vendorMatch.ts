// Typo-tolerant vendor matching for intake submissions. A sponsor types their
// own company name into a JotForm; it arrives misspelled, abbreviated, or with a
// stray "Inc." — so an exact brandKey lookup (lib/vendors) misses real matches
// and would split one advertiser into two. This scores a submitted name against
// the known vendors and returns ranked candidates with a 0–100 confidence, plus
// a DECISION the pipeline acts on:
//
//   auto    — near-certain (>= AUTO): link to the existing vendor outright.
//   suggest — plausible but not certain (>= SUGGEST): HOLD for the admin to
//             confirm before any merge (confirm-before-merge — we never fold a
//             submission into an existing vendor on a guess).
//   new     — nothing close: the caller creates a fresh (flagged) vendor.
//
// Pure + DB-free so it's unit-tested; the caller passes in the candidate list.

// Confidence thresholds (0–100). Tuned conservatively: a merge that shouldn't
// happen is worse than an extra confirm click, so AUTO is deliberately high.
export const AUTO_MATCH = 92;
export const SUGGEST_MATCH = 70;

export type MatchDecision = 'auto' | 'suggest' | 'new';
export type VendorCandidate = { id: string; name: string };
export type ScoredCandidate = { id: string; name: string; score: number };
export type MatchResult = {
  decision: MatchDecision;
  best: ScoredCandidate | null;
  candidates: ScoredCandidate[]; // top matches, best first (score desc)
};

// Corporate suffixes that carry no identity — dropped so "PackWise" matches
// "PackWise LLC". Order-independent (we compare token sets/sorted tokens).
const NOISE = new Set(['inc', 'llc', 'ltd', 'co', 'corp', 'company', 'incorporated', 'the']);

/** Lowercase, strip punctuation to spaces, drop noise words, collapse spaces. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t));
}

/** Levenshtein edit distance between two strings (iterative, O(a*b) space O(b)). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Levenshtein similarity as a 0–100 ratio (100 = identical). */
function ratio(a: string, b: string): number {
  if (!a && !b) return 100;
  const max = Math.max(a.length, b.length);
  if (!max) return 100;
  return Math.round((1 - levenshtein(a, b) / max) * 100);
}

/**
 * Similarity of two vendor names, 0–100. Word order and noise words don't
 * matter: we compare on the alphabetically-sorted, de-noised tokens (so
 * "Postal Mate Co" ≈ "Mate Postal") and also credit a strong token overlap, then
 * take the more generous of the two signals.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  // Token-sort ratio: reorder- AND typo-insensitive edit similarity. This is the
  // signal that tolerates a misspelling (one edit over a long string stays high).
  const sortRatio = ratio(ta.slice().sort().join(' '), tb.slice().sort().join(' '));
  // Exact token overlap: how many whole tokens are shared, over the larger set.
  // EXACT only (no fuzzy credit) so an all-tokens-typo'd name doesn't score a
  // false 100 — that keeps a real "suggest" band for confirm-before-merge.
  const setA = new Set(ta), setB = new Set(tb);
  let shared = 0;
  for (const t of setB) if (setA.has(t)) shared++;
  const overlap = Math.round((shared / Math.max(setA.size, setB.size)) * 100);
  return Math.max(sortRatio, overlap);
}

/** Score a submitted name against known vendors and decide how to proceed. */
export function matchVendor(name: string, candidates: VendorCandidate[]): MatchResult {
  const scored = candidates
    .map((c) => ({ id: c.id, name: c.name, score: nameSimilarity(name, c.name) }))
    .sort((x, y) => y.score - x.score);
  const best = scored[0] ?? null;
  const top = scored.filter((s) => s.score >= SUGGEST_MATCH).slice(0, 5);
  let decision: MatchDecision = 'new';
  if (best && best.score >= AUTO_MATCH) decision = 'auto';
  else if (best && best.score >= SUGGEST_MATCH) decision = 'suggest';
  return { decision, best, candidates: top };
}
