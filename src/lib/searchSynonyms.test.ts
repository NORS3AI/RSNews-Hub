import { describe, it, expect } from 'vitest';
import { expandQuery, normalizeTerm } from './searchSynonyms';

describe('normalizeTerm', () => {
  it('lowercases and strips surrounding punctuation', () => {
    expect(normalizeTerm('USPS?')).toBe('usps');
    expect(normalizeTerm('"Rates"')).toBe('rates');
    expect(normalizeTerm('post-office')).toBe('post-office'); // inner punctuation kept
  });
});

describe('expandQuery', () => {
  it('keeps the reader words at full weight and adds synonyms at half', () => {
    const out = expandQuery('usps');
    const usps = out.find((t) => t.term === 'usps');
    const postal = out.find((t) => t.term === 'postal');
    expect(usps?.weight).toBe(1);
    expect(postal?.weight).toBe(0.5);
  });

  it('a reader-typed word beats it being only a synonym (max weight wins)', () => {
    // "postal" typed directly → weight 1, even though it is also a synonym of usps.
    const out = expandQuery('postal');
    expect(out.find((t) => t.term === 'postal')?.weight).toBe(1);
  });

  it('handles multi-word queries and dedupes', () => {
    const out = expandQuery('shipping rates');
    const terms = out.map((t) => t.term);
    expect(terms).toContain('shipping');
    expect(terms).toContain('rates');
    expect(terms).toContain('postage'); // synonym of shipping
    expect(new Set(terms).size).toBe(terms.length); // no dupes
  });

  it('returns nothing for an empty/punctuation-only query', () => {
    expect(expandQuery('   ')).toEqual([]);
    expect(expandQuery('!!!')).toEqual([]);
  });

  it('caps the number of original terms', () => {
    const out = expandQuery('a b c d e f g h i j k', 3);
    // only first 3 originals expand; still returns weighted terms
    expect(out.filter((t) => t.weight === 1).length).toBeLessThanOrEqual(3);
  });
});
