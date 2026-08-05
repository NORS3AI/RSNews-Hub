import { describe, it, expect } from 'vitest';
import { addMonths, planByKey, planEnd, generateFlights, daysLeft, countdownLabel } from './adPlans';

const d = (s: string) => new Date(s);

describe('addMonths', () => {
  it('adds whole months and clamps the day of month', () => {
    expect(addMonths(d('2026-01-15T00:00:00Z'), 3).toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28'); // clamp
    expect(addMonths(d('2026-11-15T00:00:00Z'), 3).toISOString().slice(0, 10)).toBe('2027-02-15'); // year roll
  });
});

describe('planEnd', () => {
  it('derives the end for fixed plans, undefined for seasonal', () => {
    expect(planEnd(planByKey('quarter')!, d('2026-01-01T00:00:00Z'))!.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(planEnd(planByKey('annual')!, d('2026-01-01T00:00:00Z'))!.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(planEnd(planByKey('holiday')!, d('2026-09-01T00:00:00Z'))).toBeUndefined();
  });
});

describe('generateFlights', () => {
  it('splits into 3-month flights: quarter=1, half=2, annual=4', () => {
    const start = d('2026-01-01T00:00:00Z');
    expect(generateFlights(start, addMonths(start, 3))).toHaveLength(1);
    expect(generateFlights(start, addMonths(start, 6))).toHaveLength(2);
    expect(generateFlights(start, addMonths(start, 12))).toHaveLength(4);
  });

  it('flights are consecutive and cover the whole span', () => {
    const start = d('2026-01-01T00:00:00Z');
    const flights = generateFlights(start, addMonths(start, 6));
    expect(flights[0].startAt.getTime()).toBe(start.getTime());
    expect(flights[0].endAt.getTime()).toBe(flights[1].startAt.getTime()); // no gap/overlap
    expect(flights[1].endAt.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(flights.map((f) => f.index)).toEqual([1, 2]);
  });

  it('handles a custom seasonal span with a short final flight (holiday Sept→Dec)', () => {
    const flights = generateFlights(d('2026-09-01T00:00:00Z'), d('2026-12-31T00:00:00Z'));
    expect(flights).toHaveLength(2);                       // 3mo + ~1mo
    expect(flights[0].startAt.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(flights[0].endAt.toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(flights[1].endAt.toISOString().slice(0, 10)).toBe('2026-12-31'); // truncated to the span end
  });

  it('returns nothing for a non-positive span', () => {
    const start = d('2026-01-01T00:00:00Z');
    expect(generateFlights(start, start)).toEqual([]);
  });
});

describe('daysLeft / countdownLabel', () => {
  const now = d('2026-01-01T00:00:00Z');
  it('counts whole days remaining', () => {
    expect(daysLeft(d('2026-01-06T00:00:00Z'), now)).toBe(5);
    expect(daysLeft(d('2025-12-31T00:00:00Z'), now)).toBe(0); // past
  });
  it('renders a friendly label', () => {
    expect(countdownLabel(d('2026-01-06T00:00:00Z'), now)).toBe('5 days left');
    expect(countdownLabel(d('2026-01-02T00:00:00Z'), now)).toBe('1 day left');
    expect(countdownLabel(addMonths(now, 2), now)).toBe('2 months left');
    expect(countdownLabel(d('2025-12-31T00:00:00Z'), now)).toBe('ended');
  });
});
