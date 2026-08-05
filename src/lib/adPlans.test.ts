import { describe, it, expect } from 'vitest';
import { addDays, addMonths, planByKey, planEnd, generateFlights, daysLeft, countdownLabel, FLIGHT_DAYS } from './adPlans';

const d = (s: string) => new Date(s);

describe('addDays', () => {
  it('adds whole days across month/year boundaries', () => {
    expect(addDays(d('2026-01-01T00:00:00Z'), 90).toISOString().slice(0, 10)).toBe('2026-04-01'); // 31+28+31
    expect(addDays(d('2026-12-20T00:00:00Z'), 15).toISOString().slice(0, 10)).toBe('2027-01-04');
  });
});

describe('addMonths', () => {
  it('adds whole months and clamps the day of month', () => {
    expect(addMonths(d('2026-01-15T00:00:00Z'), 3).toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28'); // clamp
  });
});

describe('planEnd — flat 90-day blocks', () => {
  it('derives the end from the plan days, undefined for seasonal', () => {
    // quarter = 90 days from Jan 1 = Apr 1
    expect(planEnd(planByKey('quarter')!, d('2026-01-01T00:00:00Z'))!.toISOString().slice(0, 10)).toBe('2026-04-01');
    // annual = 360 days (NOT a calendar year) from Jan 1 = Dec 27
    expect(planEnd(planByKey('annual')!, d('2026-01-01T00:00:00Z'))!.toISOString().slice(0, 10)).toBe('2026-12-27');
    expect(planByKey('quarter')!.days).toBe(FLIGHT_DAYS);
    expect(planEnd(planByKey('holiday')!, d('2026-09-01T00:00:00Z'))).toBeUndefined();
  });
});

describe('generateFlights — 90-day flights', () => {
  it('splits into 90-day flights: quarter=1, half=2, annual=4', () => {
    const start = d('2026-01-01T00:00:00Z');
    expect(generateFlights(start, addDays(start, 90))).toHaveLength(1);
    expect(generateFlights(start, addDays(start, 180))).toHaveLength(2);
    expect(generateFlights(start, addDays(start, 360))).toHaveLength(4);
  });

  it('flights are consecutive and cover the whole span', () => {
    const start = d('2026-01-01T00:00:00Z');
    const flights = generateFlights(start, addDays(start, 180));
    expect(flights[0].startAt.getTime()).toBe(start.getTime());
    expect(flights[0].endAt.getTime()).toBe(flights[1].startAt.getTime()); // no gap/overlap
    expect(flights[1].endAt.getTime()).toBe(addDays(start, 180).getTime());
    expect(flights.map((f) => f.index)).toEqual([1, 2]);
  });

  it('handles a custom seasonal span with a short final flight (holiday Sept→Dec)', () => {
    const flights = generateFlights(d('2026-09-01T00:00:00Z'), d('2026-12-31T00:00:00Z'));
    expect(flights).toHaveLength(2);                       // 90 days + remainder
    expect(flights[0].startAt.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(flights[0].endAt.toISOString().slice(0, 10)).toBe('2026-11-30'); // Sep 1 + 90 days
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
    expect(countdownLabel(addDays(now, 60), now)).toBe('2 months left');
    expect(countdownLabel(d('2025-12-31T00:00:00Z'), now)).toBe('ended');
  });
});
