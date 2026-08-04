import { describe, it, expect } from 'vitest';
import { tenureBucket, audienceSegment, aggregateAudience, type UserInfoMap } from './audience';
import type { Ev } from './metrics';

const ev = (over: Partial<Ev>): Ev => ({ type: 'pageview', props: {}, createdAt: '2026-08-04T12:00:00Z', ...over });
const NOW = new Date('2026-08-04T12:00:00Z');

describe('tenureBucket', () => {
  it('buckets by age since signup', () => {
    expect(tenureBucket('2026-08-01T00:00:00Z', NOW)).toBe('New (<7d)');
    expect(tenureBucket('2026-07-20T00:00:00Z', NOW)).toBe('1–4 weeks');
    expect(tenureBucket('2026-06-01T00:00:00Z', NOW)).toBe('1–3 months');
    expect(tenureBucket('2026-01-01T00:00:00Z', NOW)).toBe('3–12 months');
    expect(tenureBucket('2024-01-01T00:00:00Z', NOW)).toBe('1 year+');
  });
});

const users: UserInfoMap = {
  u1: { accountType: 'MEMBER', region: 'Northeast', storeType: 'franchise', tenure: '1 year+' },
  u2: { accountType: 'VENDOR', region: null, storeType: null, tenure: 'New (<7d)' },
};

describe('audienceSegment', () => {
  it('resolves each dimension, falling back to Guest for anonymous', () => {
    expect(audienceSegment(ev({ userId: 'u1' }), 'accountType', users)).toBe('MEMBER');
    expect(audienceSegment(ev({ userId: 'u2' }), 'accountType', users)).toBe('VENDOR');
    expect(audienceSegment(ev({ userId: null }), 'accountType', users)).toBe('Guest');
    expect(audienceSegment(ev({ userId: 'u1' }), 'region', users)).toBe('Northeast');
    expect(audienceSegment(ev({ userId: 'u2' }), 'region', users)).toBe('Unspecified'); // null → Unspecified
    expect(audienceSegment(ev({ userId: 'u1' }), 'tenure', users)).toBe('1 year+');
  });
  it('auth + device dimensions do not need the user map', () => {
    expect(audienceSegment(ev({ userId: 'u1' }), 'auth', {})).toBe('Signed-in');
    expect(audienceSegment(ev({ userId: null }), 'auth', {})).toBe('Guest');
    expect(audienceSegment(ev({ device: 'mobile' }), 'device', {})).toBe('mobile');
  });
  it('a signed-in user missing from the map still segments as Guest', () => {
    expect(audienceSegment(ev({ userId: 'ghost' }), 'accountType', users)).toBe('Guest');
  });
});

describe('aggregateAudience', () => {
  it('groups uniques + engagement per segment', () => {
    const evs: Ev[] = [
      ev({ userId: 'u1', visitorId: 'v1', sessionId: 's1', type: 'pageview' }),
      ev({ userId: 'u1', visitorId: 'v1', sessionId: 's1', type: 'article_open' }),
      ev({ userId: 'u1', visitorId: 'v1', sessionId: 's2', type: 'article_open' }),
      ev({ userId: 'u2', visitorId: 'v2', sessionId: 's3', type: 'pageview' }),
      ev({ userId: null, visitorId: 'v3', sessionId: 's4', type: 'pageview' }),
    ];
    const rows = aggregateAudience(evs, 'accountType', users);
    const member = rows.find((r) => r.key === 'MEMBER')!;
    expect(member.visitors).toBe(1);
    expect(member.sessions).toBe(2);
    expect(member.pageviews).toBe(1);
    expect(member.articleOpens).toBe(2);
    expect(member.opensPerSession).toBe(1); // 2 opens / 2 sessions
    expect(rows.find((r) => r.key === 'VENDOR')!.visitors).toBe(1);
    expect(rows.find((r) => r.key === 'Guest')!.visitors).toBe(1);
  });

  it('sorts by visitors desc', () => {
    const evs: Ev[] = [
      ev({ userId: 'u2', visitorId: 'a' }),
      ev({ userId: 'u1', visitorId: 'b' }),
      ev({ userId: 'u1', visitorId: 'c' }),
    ];
    const rows = aggregateAudience(evs, 'accountType', users);
    expect(rows[0].key).toBe('MEMBER'); // 2 visitors > 1
  });
});
