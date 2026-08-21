import { describe, it, expect } from 'vitest';
import { suggestTags } from './suggestTags';

const lc = (xs: string[]) => xs.map((s) => s.toLowerCase());

describe('suggestTags — domain glossary', () => {
  it('surfaces industry terms over generic filler', () => {
    const html =
      '<p>Every store owner should think about e-commerce returns this season. ' +
      'Smart fulfillment and good packaging keep customers coming back to the shop every day.</p>';
    const tags = lc(suggestTags('Handling ecommerce returns at the counter', html));
    expect(tags).toContain('e-commerce');
    expect(tags).toContain('returns');
    expect(tags).toContain('fulfillment');
    expect(tags).toContain('packaging');
    // generic filler must NOT be suggested
    expect(tags).not.toContain('store');
    expect(tags).not.toContain('every');
    expect(tags).not.toContain('day');
  });

  it('matches spelling and hyphen variants to one canonical tag', () => {
    const tags = lc(suggestTags('Ecommerce tips', '<p>Ecommerce and e commerce both matter for pack-and-ship stores.</p>'));
    expect(tags).toContain('e-commerce');
    // not duplicated as "ecommerce" and "e commerce"
    expect(tags.filter((t) => t.includes('commerce')).length).toBe(1);
  });

  it('catches products/services: mailboxes, printing, notary', () => {
    const html = '<p>Our print services now include notary public appointments and private mailbox rentals.</p>';
    const tags = lc(suggestTags('New services', html));
    expect(tags).toContain('printing');
    expect(tags).toContain('notary');
    expect(tags.some((t) => t.includes('mailbox'))).toBe(true);
  });
});

describe('suggestTags — known-tag vocabulary (self-improving)', () => {
  it('reuses an existing tag when it appears in the text', () => {
    const html = '<p>The new Pak Mail location offers curbside drop-off for busy shippers.</p>';
    const tags = suggestTags('A new franchise opens', html, { vocabulary: ['Pak Mail', 'curbside'] });
    expect(tags).toContain('Pak Mail'); // preserves the tag's own casing
    expect(tags).toContain('curbside');
  });
});

describe('suggestTags — proper nouns / brands', () => {
  it('detects capitalized brand names and acronyms mid-sentence', () => {
    const html = '<p>The Postal Service confirmed the change. FedEx and USPS both raised rates, industry groups said.</p>';
    const tags = suggestTags('Rate changes', html);
    expect(tags).toContain('FedEx');
    expect(tags).toContain('USPS'); // also a glossary term (usps), canonical wins — either casing acceptable
    // sentence-opening "The" must not leak in as a tag
    expect(lc(tags)).not.toContain('the');
  });
});

describe('suggestTags — fallback + hygiene', () => {
  it('collapses a glossary term and its variants to one canonical tag', () => {
    const html = '<p>Shipping services are the backbone of the shop. Shipping, shipping, shipping.</p>';
    const tags = lc(suggestTags('Shipping services matter', html));
    expect(tags).toContain('shipping'); // canonical, not the "shipping services" variant
    expect(tags.filter((t) => t.includes('shipping')).length).toBe(1);
  });
  it('drops a fallback word already covered by a chosen multi-word tag', () => {
    const html = '<p>Curbside pickup is popular now. Pickup, pickup, pickup at the curb every morning.</p>';
    const tags = lc(suggestTags('A busy counter', html, { vocabulary: ['curbside pickup'] }));
    expect(tags).toContain('curbside pickup');
    expect(tags).not.toContain('pickup'); // subsumed by the phrase
  });
  it('returns an empty list for empty input', () => {
    expect(suggestTags('', '')).toEqual([]);
  });
  it('respects the max option', () => {
    const html = '<p>e-commerce returns fulfillment packaging printing notary freight shredding laminating.</p>';
    expect(suggestTags('everything', html, { max: 3 }).length).toBeLessThanOrEqual(3);
  });
});
