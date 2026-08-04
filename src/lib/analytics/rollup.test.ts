import { describe, it, expect, afterEach, vi } from 'vitest';
import { computeDay, bucketByDay, dayKey, retentionCutoff, retentionDays, recentDayKeys } from './rollup';
import type { Ev } from './metrics';

const ev = (over: Partial<Ev>): Ev => ({ type: 'pageview', props: {}, createdAt: '2026-08-04T12:00:00.000Z', ...over });

describe('dayKey', () => {
  it('is the UTC calendar day', () => {
    expect(dayKey('2026-08-04T23:59:59.000Z')).toBe('2026-08-04');
    expect(dayKey(new Date('2026-08-05T00:00:00.000Z'))).toBe('2026-08-05');
  });
});

describe('computeDay', () => {
  it('counts events, pageviews, opens, reads, clip saves', () => {
    const a = computeDay([
      ev({ type: 'pageview' }),
      ev({ type: 'pageview' }),
      ev({ type: 'article_open' }),
      ev({ type: 'read', props: {} }),
      ev({ type: 'read', props: { milestone: 50 } }), // milestone reads excluded
      ev({ type: 'clip', props: { action: 'save' } }),
      ev({ type: 'clip', props: { action: 'download' } }), // not a save
    ]);
    expect(a.events).toBe(7);
    expect(a.pageviews).toBe(2);
    expect(a.articleOpens).toBe(1);
    expect(a.reads).toBe(1);
    expect(a.clipSaves).toBe(1);
  });

  it('counts ad impressions / viewable / clicks only for ad subjects', () => {
    const a = computeDay([
      ev({ type: 'impression', subjectType: 'ad', props: { viewable: true } }),
      ev({ type: 'impression', subjectType: 'ad', props: {} }),
      ev({ type: 'click', subjectType: 'ad', props: {} }),
      ev({ type: 'impression', subjectType: 'article', props: { viewable: true } }), // not an ad
    ]);
    expect(a.adImpressions).toBe(2);
    expect(a.adViewable).toBe(1);
    expect(a.adClicks).toBe(1);
  });

  it('counts distinct visitors and sessions', () => {
    const a = computeDay([
      ev({ visitorId: 'v1', sessionId: 's1' }),
      ev({ visitorId: 'v1', sessionId: 's2' }), // same visitor, new session
      ev({ visitorId: 'v2', sessionId: 's2' }),
      ev({ visitorId: null, sessionId: null }),
    ]);
    expect(a.visitors).toBe(2);
    expect(a.sessions).toBe(2);
  });
});

describe('bucketByDay', () => {
  it('splits events into per-UTC-day aggregates', () => {
    const m = bucketByDay([
      ev({ type: 'pageview', createdAt: '2026-08-04T10:00:00Z' }),
      ev({ type: 'pageview', createdAt: '2026-08-04T20:00:00Z' }),
      ev({ type: 'pageview', createdAt: '2026-08-05T01:00:00Z' }),
    ]);
    expect(m.get('2026-08-04')?.pageviews).toBe(2);
    expect(m.get('2026-08-05')?.pageviews).toBe(1);
  });
});

describe('retentionCutoff', () => {
  const now = new Date('2026-08-04T00:00:00.000Z');
  it('is null when retention is disabled (<=0)', () => {
    expect(retentionCutoff(now, 0)).toBeNull();
    expect(retentionCutoff(now, -5)).toBeNull();
  });
  it('is now minus N days when enabled', () => {
    expect(retentionCutoff(now, 30)?.toISOString()).toBe('2026-07-05T00:00:00.000Z');
  });
});

describe('retentionDays', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('defaults to 365 and reads the env override (0 allowed = disabled)', () => {
    expect(retentionDays()).toBe(365);
    vi.stubEnv('ANALYTICS_RETENTION_DAYS', '90');
    expect(retentionDays()).toBe(90);
    vi.stubEnv('ANALYTICS_RETENTION_DAYS', '0');
    expect(retentionDays()).toBe(0);
  });
});

describe('recentDayKeys', () => {
  it('returns N keys oldest→newest ending today', () => {
    const keys = recentDayKeys(new Date('2026-08-04T12:00:00Z'), 3);
    expect(keys).toEqual(['2026-08-02', '2026-08-03', '2026-08-04']);
  });
});
