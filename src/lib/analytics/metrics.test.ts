import { describe, it, expect } from 'vitest';
import { ctr, pct, splitDim, aggregateAds, aggregateEngagement, aggregateReading, aggregateClips, aggregateOverview, type Ev } from './metrics';

const ev = (p: Partial<Ev>): Ev => ({ type: 'impression', props: {}, createdAt: new Date('2026-01-01'), ...p });

describe('ratio helpers', () => {
  it('ctr guards divide-by-zero', () => {
    expect(ctr(3, 12)).toBe(0.25);
    expect(ctr(5, 0)).toBe(0);
  });
  it('pct guards divide-by-zero', () => {
    expect(pct(1, 4)).toBe(0.25);
    expect(pct(1, 0)).toBe(0);
  });
});

describe('splitDim', () => {
  it('resolves image vs none from props', () => {
    expect(splitDim(ev({ props: { hasImage: true } }), 'hasImage')).toBe('with image');
    expect(splitDim(ev({ props: { hasImage: false } }), 'hasImage')).toBe('no image');
  });
  it('resolves campaign/creative/format from props', () => {
    expect(splitDim(ev({ props: { campaignId: 'PackWise' } }), 'campaign')).toBe('PackWise');
    expect(splitDim(ev({ props: { format: 'image' } }), 'format')).toBe('image');
  });
});

describe('aggregateAds', () => {
  const evs: Ev[] = [
    ev({ type: 'impression', subjectType: 'ad', placement: 'home-top', props: { viewable: true, aboveFold: true, dwellMs: 2000 } }),
    ev({ type: 'impression', subjectType: 'ad', placement: 'home-top', props: { viewable: true, aboveFold: false, dwellMs: 4000 } }),
    ev({ type: 'click', subjectType: 'ad', placement: 'home-top', props: {} }),
    ev({ type: 'impression', subjectType: 'ad', placement: 'article-bottom', props: { viewable: true, dwellMs: 1000 } }),
    ev({ type: 'impression', subjectType: 'article', placement: 'latest', props: {} }), // ignored
  ];
  it('groups ads by placement with viewability, dwell, above-fold and CTR', () => {
    const rows = aggregateAds(evs, 'placement');
    const top = rows.find((r) => r.key === 'home-top')!;
    expect(top.impressions).toBe(2);
    expect(top.viewable).toBe(2);
    expect(top.clicks).toBe(1);
    expect(top.ctr).toBe(0.5); // 1 click / 2 viewable
    expect(top.avgDwellMs).toBe(3000);
    expect(top.aboveFoldPct).toBe(0.5);
  });
  it('excludes non-ad events', () => {
    expect(aggregateAds(evs, 'placement').some((r) => r.key === 'latest')).toBe(false);
  });
});

describe('aggregateEngagement (image vs none)', () => {
  const evs: Ev[] = [
    ev({ type: 'impression', subjectType: 'article', props: { hasImage: true } }),
    ev({ type: 'impression', subjectType: 'article', props: { hasImage: true } }),
    ev({ type: 'click', subjectType: 'article', props: { hasImage: true } }),
    ev({ type: 'impression', subjectType: 'article', props: { hasImage: false } }),
    ev({ type: 'click', subjectType: 'article', props: { hasImage: false } }),
  ];
  it('compares CTR within the split dimension', () => {
    const rows = aggregateEngagement(evs, 'hasImage');
    expect(rows.find((r) => r.key === 'with image')!.ctr).toBe(0.5);
    expect(rows.find((r) => r.key === 'no image')!.ctr).toBe(1);
  });
});

describe('aggregateReading', () => {
  const evs: Ev[] = [
    ev({ type: 'article_open', subjectType: 'article', subjectId: 'a1', visitorId: 'v1' }),
    ev({ type: 'article_open', subjectType: 'article', subjectId: 'a1', visitorId: 'v1' }), // same reader
    ev({ type: 'read', subjectType: 'article', props: { activeMs: 60000, scrollPct: 80 } }),
    ev({ type: 'read', subjectType: 'article', props: { activeMs: 2000, scrollPct: 10 } }), // bounce
    ev({ type: 'read', subjectType: 'article', props: { milestone: 50 } }), // milestone crossings are ignored for reach
    ev({ type: 'read', subjectType: 'article', props: { milestone: 25 } }),
  ];
  it('computes active time, unique readers, bounces and scroll reach (never >100%)', () => {
    const r = aggregateReading(evs);
    expect(r.opens).toBe(2);
    expect(r.uniqueReaders).toBe(1);
    expect(r.avgActiveMs).toBe(31000);
    expect(r.bounces).toBe(1);
    // 2 finalized reads (scrollPct 80 and 10): one crossed 25/50/75, neither hit 100.
    expect(r.reach[25]).toBe(0.5);
    expect(r.reach[75]).toBe(0.5);
    expect(r.reach[100]).toBe(0);
  });
});

describe('aggregateClips + overview', () => {
  const evs: Ev[] = [
    ev({ type: 'clip', props: { action: 'save', kind: 'comic' }, visitorId: 'v1' }),
    ev({ type: 'clip', props: { action: 'save', kind: 'quote' }, visitorId: 'v2' }),
    ev({ type: 'clip', props: { action: 'download' } }),
    ev({ type: 'pageview', sessionId: 's1', device: 'mobile', pageType: 'home', visitorId: 'v1' }),
    ev({ type: 'pageview', sessionId: 's1', device: 'mobile', pageType: 'article', visitorId: 'v1' }),
    ev({ type: 'article_open', sessionId: 's1', visitorId: 'v1' }),
  ];
  it('builds the clip funnel', () => {
    const c = aggregateClips(evs);
    expect(c.saves).toBe(2);
    expect(c.savers).toBe(2);
    expect(c.byKind.comic).toBe(1);
    expect(c.downloads).toBe(1);
  });
  it('summarizes hub overview', () => {
    const o = aggregateOverview(evs);
    expect(o.pageviews).toBe(2);
    expect(o.sessions).toBe(1);
    expect(o.articleOpens).toBe(1);
    expect(o.opensPerSession).toBe(1);
  });
});
