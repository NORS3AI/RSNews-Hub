import { describe, it, expect } from 'vitest';
import { aggregateActivation, aggregateNewVsReturning, aggregateCohortReturn, type MemberInfo } from './retention';
import type { Ev } from './metrics';

// Minimal event factory.
const ev = (userId: string | null, type: string, day: string): Ev => ({
  type, subjectType: null, subjectId: null, placement: null, pageType: null, device: null,
  visitorId: userId ? `v-${userId}` : 'anon', userId, sessionId: 's', value: null, props: {},
  createdAt: new Date(`${day}T12:00:00Z`),
});

const members: MemberInfo[] = [
  { id: 'a', createdAt: new Date('2026-08-01T00:00:00Z') },
  { id: 'b', createdAt: new Date('2026-08-10T00:00:00Z') },
  { id: 'c', createdAt: new Date('2026-08-10T00:00:00Z') }, // joined but never active
];

describe('aggregateActivation', () => {
  it('counts members, active, engaged, and returned (2+ days)', () => {
    const evs: Ev[] = [
      ev('a', 'pageview', '2026-08-10'),   // active, but only a pageview (not engaged)
      ev('a', 'article_open', '2026-08-11'), // engaged + a 2nd day => returned
      ev('b', 'pageview', '2026-08-10'),   // active only, one day, no meaningful action
      ev(null, 'read', '2026-08-11'), // anonymous — ignored
    ];
    const f = aggregateActivation(members, evs);
    expect(f.members).toBe(3);
    expect(f.active).toBe(2);   // a, b
    expect(f.engaged).toBe(1);  // a (article_open)
    expect(f.returned).toBe(1); // a on two days
  });

  it('ignores events from non-members and anonymous visitors', () => {
    const evs = [ev('zzz', 'read', '2026-08-10'), ev(null, 'read', '2026-08-10')];
    const f = aggregateActivation(members, evs);
    expect(f.active).toBe(0);
    expect(f.engaged).toBe(0);
  });
});

describe('aggregateNewVsReturning', () => {
  it('splits each active day into new (first day) vs returning', () => {
    const evs = [
      ev('a', 'read', '2026-08-01'),  // a's first day -> new
      ev('a', 'read', '2026-08-11'),  // later -> returning
      ev('b', 'read', '2026-08-10'),  // b's first day -> new
    ];
    const rows = aggregateNewVsReturning(members, evs);
    expect(rows).toEqual([
      { day: '2026-08-01', newMembers: 1, returningMembers: 0 },
      { day: '2026-08-10', newMembers: 1, returningMembers: 0 },
      { day: '2026-08-11', newMembers: 0, returningMembers: 1 },
    ]);
  });
});

describe('aggregateCohortReturn', () => {
  it('measures the share of window-new members who came back on a later day', () => {
    const since = new Date('2026-08-05T00:00:00Z'); // b & c are the cohort (joined 08-10)
    const evs = [
      ev('b', 'read', '2026-08-10'), // first day
      ev('b', 'read', '2026-08-12'), // later -> returned
      ev('c', 'read', '2026-08-10'), // only first day -> not returned
      ev('a', 'read', '2026-08-11'), // a joined before window -> not in cohort
    ];
    const c = aggregateCohortReturn(members, evs, since);
    expect(c.cohortSize).toBe(2);   // b, c
    expect(c.returned).toBe(1);     // b
    expect(c.returnRate).toBeCloseTo(0.5);
  });
});
