import { describe, it, expect } from 'vitest';
import { adIsSafe, adIsRelevant, pickInArticleAd, adsAreRivals, pickTwoInArticleAds, type AdRow } from './ads';

function ad(partial: Partial<AdRow> & { id: string; brand: string }): AdRow {
  return {
    label: null, headline: `${partial.brand} headline`, cta: 'Learn more', href: '#',
    accent: '#000', keywords: '', competitors: '', active: true, ...partial,
  };
}

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
