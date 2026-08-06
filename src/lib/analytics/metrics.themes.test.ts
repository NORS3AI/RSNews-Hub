import { describe, it, expect } from 'vitest';
import { aggregateThemes, type Ev } from './metrics';

function ev(partial: Partial<Ev> & { props: Record<string, unknown> }): Ev {
  return {
    type: 'theme', subjectType: null, subjectId: null, placement: null, pageType: null,
    device: 'desktop', visitorId: null, userId: null, sessionId: null, value: null,
    createdAt: new Date('2026-08-01T00:00:00Z'), ...partial,
  } as Ev;
}

describe('aggregateThemes', () => {
  it('counts each actor once by their most recent theme', () => {
    const evs: Ev[] = [
      ev({ visitorId: 'v1', props: { theme: 'light', reason: 'active' }, createdAt: new Date('2026-08-01T10:00:00Z') }),
      // v1 later switches to RS — should land in RS, not double-counted.
      ev({ visitorId: 'v1', props: { theme: 'rs', reason: 'switch' }, createdAt: new Date('2026-08-01T11:00:00Z') }),
      ev({ visitorId: 'v2', props: { theme: 'dark', reason: 'active' } }),
      ev({ userId: 'u3', props: { theme: 'rs', reason: 'active' } }),
    ];
    const { rows, totalUsers, switches } = aggregateThemes(evs);
    expect(totalUsers).toBe(3); // v1, v2, u3
    expect(switches).toBe(1);
    const by = Object.fromEntries(rows.map((r) => [r.theme, r.users]));
    expect(by).toEqual({ light: 0, dark: 1, rs: 2 });
    const rs = rows.find((r) => r.theme === 'rs')!;
    expect(rs.pct).toBeCloseTo(2 / 3);
  });

  it('prefers userId over visitorId/session as the actor key', () => {
    // Same signed-in member across two devices (different visitor ids) = 1 user.
    const evs: Ev[] = [
      ev({ userId: 'u1', visitorId: 'dev-a', props: { theme: 'dark', reason: 'active' } }),
      ev({ userId: 'u1', visitorId: 'dev-b', props: { theme: 'dark', reason: 'active' } }),
    ];
    const { totalUsers } = aggregateThemes(evs);
    expect(totalUsers).toBe(1);
  });

  it('ignores non-theme events and unknown theme values', () => {
    const evs: Ev[] = [
      ev({ type: 'pageview', visitorId: 'v1', props: {} }),
      ev({ visitorId: 'v2', props: { theme: 'neon' } }),
      ev({ visitorId: 'v3', props: { theme: 'light' } }),
    ];
    const { totalUsers, rows } = aggregateThemes(evs);
    expect(totalUsers).toBe(1);
    expect(rows.find((r) => r.theme === 'light')!.users).toBe(1);
  });

  it('handles an empty window', () => {
    const { totalUsers, rows, switches } = aggregateThemes([]);
    expect(totalUsers).toBe(0);
    expect(switches).toBe(0);
    expect(rows.every((r) => r.users === 0 && r.pct === 0)).toBe(true);
  });
});
