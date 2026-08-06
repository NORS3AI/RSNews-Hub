import { describe, it, expect } from 'vitest';
import { adIsSafe, adIsRelevant, pickInArticleAd, adsAreRivals, pickTwoInArticleAds, adIsLive, type AdRow } from './ads';

function ad(partial: Partial<AdRow> & { id: string; brand: string }): AdRow {
  return {
    label: null, headline: `${partial.brand} headline`, cta: 'Learn more', href: '#',
    accent: '#000', keywords: '', competitors: '', active: true, ...partial,
  };
}

const NOW = new Date('2026-06-15T00:00:00Z');
const inWindow = { flightStartAt: '2026-06-01T00:00:00Z', flightEndAt: '2026-09-01T00:00:00Z' };

describe('adIsLive', () => {
  it('house ads (no flight) follow the active flag', () => {
    expect(adIsLive(ad({ id: 'h', brand: 'House', active: true }), NOW)).toBe(true);
    expect(adIsLive(ad({ id: 'h', brand: 'House', active: false }), NOW)).toBe(false);
  });
  it('flighted ads are live only when SCHEDULED and inside the window', () => {
    expect(adIsLive(ad({ id: 'f', brand: 'V', flightId: 'fl', flightStatus: 'SCHEDULED', ...inWindow }), NOW)).toBe(true);
    expect(adIsLive(ad({ id: 'f', brand: 'V', flightId: 'fl', flightStatus: 'REVIEW', ...inWindow }), NOW)).toBe(false); // not scheduled
    expect(adIsLive(ad({ id: 'f', brand: 'V', flightId: 'fl', flightStatus: 'SCHEDULED', flightStartAt: '2026-07-01T00:00:00Z', flightEndAt: '2026-10-01T00:00:00Z' }), NOW)).toBe(false); // before window
    expect(adIsLive(ad({ id: 'f', brand: 'V', flightId: 'fl', flightStatus: 'SCHEDULED', flightStartAt: '2026-01-01T00:00:00Z', flightEndAt: '2026-04-01T00:00:00Z' }), NOW)).toBe(false); // after window (auto-takedown)
  });
  it('competitor suppression uses the tag/safe text, not the body, when given', () => {
    const shipRite = ad({ id: 's', brand: 'ShipRite', competitors: 'PostalMate' });
    const body = 'A general article that happens to name PostalMate in passing.';
    // No safeText → matches body (legacy behavior): suppressed.
    expect(pickInArticleAd([shipRite], body, 'x', NOW)).toBeNull();
    // safeText = tags without the rival → shown (body mention ignored).
    expect(pickInArticleAd([shipRite], body, 'x', NOW, '', 'Shipping Retail')).toBe(shipRite);
    // safeText = tags WITH the rival → suppressed.
    expect(pickInArticleAd([shipRite], body, 'x', NOW, '', 'PostalMate')).toBeNull();
  });
  it('manually-added ads honor an optional self-scheduling window (blank = always on)', () => {
    // our-brand default: no window → always on when active
    expect(adIsLive(ad({ id: 'm', brand: 'RSA', active: true }), NOW)).toBe(true);
    // outside advertiser with a window around NOW → live
    expect(adIsLive(ad({ id: 'm', brand: 'Out', liveFrom: '2026-06-01T00:00:00Z', liveUntil: '2026-07-01T00:00:00Z' }), NOW)).toBe(true);
    // before it starts / after it ends → not live
    expect(adIsLive(ad({ id: 'm', brand: 'Out', liveFrom: '2026-07-01T00:00:00Z' }), NOW)).toBe(false);
    expect(adIsLive(ad({ id: 'm', brand: 'Out', liveUntil: '2026-06-01T00:00:00Z' }), NOW)).toBe(false);
    // inactive always beats a valid window
    expect(adIsLive(ad({ id: 'm', brand: 'Out', active: false, liveFrom: '2026-06-01T00:00:00Z', liveUntil: '2026-07-01T00:00:00Z' }), NOW)).toBe(false);
  });
});

describe('pickInArticleAd — paid inventory preference', () => {
  it('serves a live paid (flighted) ad over an eligible house ad', () => {
    const house = ad({ id: 'house', brand: 'House' });
    const paid = ad({ id: 'paid', brand: 'Vendor', flightId: 'fl', flightStatus: 'SCHEDULED', ...inWindow });
    const pick = pickInArticleAd([house, paid], 'some article text', 'seed', NOW);
    expect(pick?.id).toBe('paid');
  });
  it('excludes a flighted ad whose window has passed (falls back to house)', () => {
    const house = ad({ id: 'house', brand: 'House' });
    const expired = ad({ id: 'old', brand: 'Vendor', flightId: 'fl', flightStatus: 'SCHEDULED', flightStartAt: '2026-01-01T00:00:00Z', flightEndAt: '2026-04-01T00:00:00Z' });
    const pick = pickInArticleAd([house, expired], 'text', 'seed', NOW);
    expect(pick?.id).toBe('house');
  });

  it('surfaces the VISITING vendor’s own live ad first (favorBrand)', () => {
    const house = ad({ id: 'house', brand: 'House' });
    const paid = ad({ id: 'paid', brand: 'OtherVendor', flightId: 'fl', flightStatus: 'SCHEDULED', ...inWindow });
    const mine = ad({ id: 'mine', brand: 'PackWise', flightId: 'fl2', flightStatus: 'SCHEDULED', ...inWindow });
    // Without favorBrand, a paid ad wins; with it, the vendor's own brand wins.
    expect(pickInArticleAd([house, paid, mine], 'text', 'seed', NOW)?.brand).not.toBe('PackWise');
    expect(pickInArticleAd([house, paid, mine], 'text', 'seed', NOW, 'packwise')?.id).toBe('mine');
  });

  it('does not surface the vendor’s own ad if it is not currently live', () => {
    const paid = ad({ id: 'paid', brand: 'OtherVendor', flightId: 'fl', flightStatus: 'SCHEDULED', ...inWindow });
    const mineExpired = ad({ id: 'mine', brand: 'PackWise', flightId: 'fl2', flightStatus: 'SCHEDULED', flightStartAt: '2026-01-01T00:00:00Z', flightEndAt: '2026-02-01T00:00:00Z' });
    expect(pickInArticleAd([paid, mineExpired], 'text', 'seed', NOW, 'packwise')?.id).toBe('paid');
  });
});

const postalmate = ad({ id: 'pm', brand: 'PostalMate', keywords: 'PostalMate, postal mate', competitors: 'ShipRite, ship rite' });
const shiprite = ad({ id: 'sr', brand: 'ShipRite', keywords: 'ShipRite, ship rite', competitors: 'PostalMate, postal mate' });
const neutral = ad({ id: 'nz', brand: 'BrewCrate' });

describe('adIsSafe', () => {
  it('suppresses an ad whose competitor is named in the article', () => {
    expect(adIsSafe(shiprite, ' this article covers postalmate deeply. ')).toBe(false);
  });
  it('allows an ad when no competitor is mentioned', () => {
    expect(adIsSafe(shiprite, ' a general article about shipping boxes. ')).toBe(true);
  });
  it('does not match a competitor term embedded inside another word', () => {
    // "postalmated" should not count as a mention of "postalmate"
    expect(adIsSafe(shiprite, ' the postalmated widget is unrelated ')).toBe(true);
  });
});

describe('adIsRelevant', () => {
  it('is relevant when the ad’s own brand term appears', () => {
    expect(adIsRelevant(postalmate, ' we love postalmate at the counter ')).toBe(true);
  });
  it('is not relevant to an off-topic article', () => {
    expect(adIsRelevant(postalmate, ' an article about coffee ')).toBe(false);
  });
});

describe('pickInArticleAd', () => {
  it('never returns an ad whose competitor is in the article', () => {
    const article = 'Everything you need to know about PostalMate.';
    const pick = pickInArticleAd([postalmate, shiprite, neutral], article, 'slot-1');
    expect(pick?.id).not.toBe('sr'); // ShipRite lists PostalMate as a competitor
  });

  it('prefers a topically relevant ad over a neutral one', () => {
    const article = 'A deep dive on PostalMate for your store.';
    const pick = pickInArticleAd([postalmate, neutral], article, 'slot-1');
    expect(pick?.id).toBe('pm');
  });

  it('is deterministic for the same inventory + slot seed', () => {
    const article = 'General shipping tips.';
    const a = pickInArticleAd([postalmate, shiprite, neutral], article, 'same-seed');
    const b = pickInArticleAd([postalmate, shiprite, neutral], article, 'same-seed');
    expect(a?.id).toBe(b?.id);
  });

  it('returns null when every ad is unsafe', () => {
    const article = 'PostalMate and ShipRite mentioned together.';
    expect(pickInArticleAd([postalmate, shiprite], article, 'slot-1')).toBeNull();
  });
});

describe('adsAreRivals', () => {
  it('flags two competitors as rivals', () => {
    expect(adsAreRivals(postalmate, shiprite)).toBe(true);
  });
  it('does not flag unrelated ads', () => {
    expect(adsAreRivals(postalmate, neutral)).toBe(false);
  });
});

describe('pickTwoInArticleAds', () => {
  it('never pairs two rivals in the top and bottom slots', () => {
    const article = 'General shipping and packing tips.';
    const { top, bottom } = pickTwoInArticleAds([postalmate, shiprite, neutral], article, 'art-1');
    if (top && bottom) expect(adsAreRivals(top, bottom)).toBe(false);
  });
});
