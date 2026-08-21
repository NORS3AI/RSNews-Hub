import { describe, it, expect } from 'vitest';
import { publishFlags, hasBlockingFlag, authorCardsInHtml, bylineMismatch, describeTiming, type PublishInput, type AdEntry } from './publishChecklist';

const NOW = new Date('2026-08-21T12:00:00').getTime();

const base = (over: Partial<PublishInput> = {}): PublishInput => ({
  title: 'A story', bylineName: '', publishedAt: '', now: NOW,
  primaryCategory: 'Industry News', extraCategories: [], genre: '', tags: [],
  connectedVendor: '', sponsored: false, breaking: false, featured: false, pinned: false,
  ads: [], authorCards: [], ...over,
});
const ad = (o: Partial<AdEntry> & { index: number }): AdEntry => ({ kind: 'slot', size: 'wide', brand: '', label: '', ...o });

describe('describeTiming', () => {
  it('reads blank as now', () => { expect(describeTiming('', NOW).kind).toBe('now'); });
  it('reads a future date as scheduled', () => { expect(describeTiming('2026-12-01T09:00', NOW).kind).toBe('scheduled'); });
  it('reads a past date as backdated', () => { expect(describeTiming('2026-01-01T09:00', NOW).kind).toBe('backdated'); });
});

describe('publishFlags — categories', () => {
  it('warns when no category is set', () => {
    const f = publishFlags(base({ primaryCategory: '', extraCategories: [] }));
    expect(f.some((x) => x.level === 'warn' && /category/i.test(x.text))).toBe(true);
  });
  it('is quiet when an extra category covers it', () => {
    const f = publishFlags(base({ primaryCategory: '', extraCategories: ['Blog'] }));
    expect(f.some((x) => /category/i.test(x.text))).toBe(false);
  });
});

describe('publishFlags — byline vs Author card', () => {
  it('BLOCKS when the top byline and an Author card name different people', () => {
    const f = publishFlags(base({ bylineName: 'Eric Nord', authorCards: ['Jane Smith'] }));
    expect(f.some((x) => x.level === 'block' && x.text.includes('Eric Nord') && x.text.includes('Jane Smith'))).toBe(true);
    expect(hasBlockingFlag(f)).toBe(true);
  });
  it('does not block or warn when they match (case-insensitive)', () => {
    const f = publishFlags(base({ bylineName: 'Eric Nord', authorCards: ['eric nord'] }));
    expect(f.some((x) => x.text.includes('Author card'))).toBe(false);
    expect(hasBlockingFlag(f)).toBe(false);
  });
  it('notes (info) when the top is the house team but a card names someone', () => {
    const f = publishFlags(base({ bylineName: '', authorCards: ['Jane Smith'] }));
    expect(f.some((x) => x.level === 'info' && x.text.includes('Jane Smith'))).toBe(true);
  });
});

describe('publishFlags — ads', () => {
  it('warns when the article pins two different advertisers', () => {
    const f = publishFlags(base({ ads: [ad({ index: 1, brand: 'acme', label: 'Acme' }), ad({ index: 2, brand: 'globex', label: 'Globex' })] }));
    expect(f.some((x) => x.level === 'warn' && /2 different advertisers/i.test(x.text))).toBe(true);
  });
  it('is quiet for a single pinned advertiser', () => {
    const f = publishFlags(base({ ads: [ad({ index: 1, brand: 'acme', label: 'Acme' })] }));
    expect(f.some((x) => /different advertisers/i.test(x.text))).toBe(false);
  });
  it('is quiet for Auto (unbranded) slots', () => {
    const f = publishFlags(base({ ads: [ad({ index: 1 }), ad({ index: 2 })] }));
    expect(f.some((x) => /advertiser/i.test(x.text))).toBe(false);
  });
});

describe('publishFlags — connected vendor', () => {
  it('always asks to confirm a vendor piece', () => {
    const f = publishFlags(base({ connectedVendor: 'BoxCo' }));
    expect(f.some((x) => x.level === 'info' && x.text.includes('BoxCo'))).toBe(true);
  });
  it('warns when a pinned ad is a different brand than the locked vendor', () => {
    const f = publishFlags(base({ connectedVendor: 'BoxCo', ads: [ad({ index: 1, brand: 'acme', label: 'Acme' })] }));
    expect(f.some((x) => x.level === 'warn' && x.text.includes('BoxCo') && x.text.includes('Acme'))).toBe(true);
  });
  it('does not warn when the pinned ad matches the vendor', () => {
    const f = publishFlags(base({ connectedVendor: 'BoxCo', ads: [ad({ index: 1, brand: 'boxco', label: 'BoxCo' })] }));
    expect(f.some((x) => x.level === 'warn')).toBe(false);
  });
});

describe('publishFlags — clean article', () => {
  it('returns no flags when everything is ordinary', () => {
    expect(publishFlags(base({ bylineName: 'Eric Nord', tags: ['usps'] }))).toEqual([]);
  });
});

describe('authorCardsInHtml — server-safe parse', () => {
  it('pulls the name and linked byline id from Author card divs', () => {
    const html = '<p>hi</p><div data-author="" data-name="Jane Smith" data-title="Reporter" data-bylineid="by_1"></div>';
    expect(authorCardsInHtml(html)).toEqual([{ name: 'Jane Smith', bylineId: 'by_1' }]);
  });
  it('decodes HTML entities in the name', () => {
    const html = '<div data-author="" data-name="Ben &amp; Co" data-bylineid=""></div>';
    expect(authorCardsInHtml(html)[0].name).toBe('Ben & Co');
  });
  it('is empty when there are no Author cards', () => {
    expect(authorCardsInHtml('<p>just prose</p>')).toEqual([]);
  });
});

describe('bylineMismatch — the hard-lock check', () => {
  it('returns the offending card name when it differs from a named top byline', () => {
    expect(bylineMismatch('Eric Nord', ['Jane Smith'])).toBe('Jane Smith');
  });
  it('is null when they match (case-insensitive)', () => {
    expect(bylineMismatch('Eric Nord', ['eric nord'])).toBeNull();
  });
  it('is null for the house-team default (no top name)', () => {
    expect(bylineMismatch('', ['Jane Smith'])).toBeNull();
  });
});

describe('hasBlockingFlag — only the byline mismatch blocks', () => {
  const ad = (o: Partial<AdEntry> & { index: number }): AdEntry => ({ kind: 'slot', size: 'wide', brand: '', label: '', ...o });
  it('a missing category warns but does not block', () => {
    expect(hasBlockingFlag(publishFlags(base({ primaryCategory: '', extraCategories: [] })))).toBe(false);
  });
  it('two pinned advertisers warns but does not block', () => {
    const f = publishFlags(base({ ads: [ad({ index: 1, brand: 'a', label: 'A' }), ad({ index: 2, brand: 'b', label: 'B' })] }));
    expect(hasBlockingFlag(f)).toBe(false);
  });
});
