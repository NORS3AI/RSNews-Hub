import { describe, it, expect } from 'vitest';
import { levenshtein, nameSimilarity, matchVendor, AUTO_MATCH, SUGGEST_MATCH } from './vendorMatch';

describe('levenshtein', () => {
  it('is 0 for identical strings', () => expect(levenshtein('abc', 'abc')).toBe(0));
  it('counts single edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('nameSimilarity', () => {
  it('is 100 for the same name in different casing/whitespace', () => {
    expect(nameSimilarity('PackWise', ' packwise ')).toBe(100);
  });
  it('ignores corporate noise words', () => {
    expect(nameSimilarity('PackWise', 'PackWise LLC')).toBe(100);
    expect(nameSimilarity('The Postal Co', 'Postal')).toBe(100);
  });
  it('is order-insensitive', () => {
    expect(nameSimilarity('Postal Mate', 'Mate Postal')).toBeGreaterThanOrEqual(AUTO_MATCH);
  });
  it('tolerates a typo', () => {
    expect(nameSimilarity('PostalMate', 'PostlMate')).toBeGreaterThanOrEqual(SUGGEST_MATCH);
  });
  it('scores unrelated names low', () => {
    expect(nameSimilarity('PackWise', 'ShipRight Supplies')).toBeLessThan(SUGGEST_MATCH);
  });
  it('is 0 when a side is empty/only-noise', () => {
    expect(nameSimilarity('Inc', 'PackWise')).toBe(0);
    expect(nameSimilarity('', 'PackWise')).toBe(0);
  });
});

describe('matchVendor', () => {
  const vendors = [
    { id: 'v1', name: 'PackWise' },
    { id: 'v2', name: 'ShipRight Supplies' },
    { id: 'v3', name: 'Postal Mate' },
  ];

  it('auto-links a near-certain match', () => {
    const r = matchVendor('packwise llc', vendors);
    expect(r.decision).toBe('auto');
    expect(r.best?.id).toBe('v1');
  });

  it('suggests (holds) an uncertain typo match — confirm before merge', () => {
    const r = matchVendor('Postl Mate', vendors);
    expect(r.decision).toBe('suggest');
    expect(r.best?.id).toBe('v3');
    expect(r.best!.score).toBeGreaterThanOrEqual(SUGGEST_MATCH);
    expect(r.best!.score).toBeLessThan(AUTO_MATCH);
  });

  it('returns new when nothing is close', () => {
    const r = matchVendor('Brand New Vendor Co', vendors);
    expect(r.decision).toBe('new');
  });

  it('ranks candidates best-first and caps the list', () => {
    const r = matchVendor('PackWise', vendors);
    expect(r.candidates[0].id).toBe('v1');
    expect(r.candidates.every((c, i) => i === 0 || c.score <= r.candidates[i - 1].score)).toBe(true);
  });

  it('handles an empty vendor list', () => {
    const r = matchVendor('Anyone', []);
    expect(r.decision).toBe('new');
    expect(r.best).toBeNull();
  });
});
