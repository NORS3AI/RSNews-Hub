import { describe, it, expect } from 'vitest';
import { isSeasonActive, windowSpansYearEnd, formatWindow, clampWindow, daysUntilOpen, monthDayLabel } from './seasonal';

const D = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('isSeasonActive — normal (within one year) window', () => {
  const back2school = { startMonth: 8, startDay: 1, endMonth: 9, endDay: 15 };
  it('includes the boundaries and everything between', () => {
    expect(isSeasonActive(back2school, D(2026, 8, 1))).toBe(true);
    expect(isSeasonActive(back2school, D(2026, 9, 15))).toBe(true);
    expect(isSeasonActive(back2school, D(2026, 8, 20))).toBe(true);
  });
  it('excludes days outside it', () => {
    expect(isSeasonActive(back2school, D(2026, 7, 31))).toBe(false);
    expect(isSeasonActive(back2school, D(2026, 9, 16))).toBe(false);
    expect(isSeasonActive(back2school, D(2026, 1, 1))).toBe(false);
  });
});

describe('isSeasonActive — window that wraps the New Year', () => {
  const holiday = { startMonth: 11, startDay: 1, endMonth: 1, endDay: 5 };
  it('is active across the year boundary', () => {
    expect(windowSpansYearEnd(holiday)).toBe(true);
    expect(isSeasonActive(holiday, D(2026, 11, 1))).toBe(true);   // opening day
    expect(isSeasonActive(holiday, D(2026, 12, 25))).toBe(true);  // deep in
    expect(isSeasonActive(holiday, D(2027, 1, 5))).toBe(true);    // closing day (next year)
    expect(isSeasonActive(holiday, D(2027, 1, 6))).toBe(false);   // just after
    expect(isSeasonActive(holiday, D(2026, 10, 31))).toBe(false); // just before
    expect(isSeasonActive(holiday, D(2026, 6, 1))).toBe(false);   // mid-year
  });
});

describe('formatting + validation', () => {
  it('labels a window', () => {
    expect(monthDayLabel(11, 1)).toBe('Nov 1');
    expect(formatWindow({ startMonth: 11, startDay: 1, endMonth: 1, endDay: 5 })).toBe('Nov 1 – Jan 5');
  });
  it('clamps out-of-range month/day', () => {
    expect(clampWindow({ startMonth: 0, startDay: 99, endMonth: 13, endDay: 0 }))
      .toEqual({ startMonth: 1, startDay: 31, endMonth: 12, endDay: 1 });
  });
});

describe('daysUntilOpen', () => {
  const holiday = { startMonth: 11, startDay: 1, endMonth: 1, endDay: 5 };
  it('is 0 while open', () => {
    expect(daysUntilOpen(holiday, D(2026, 12, 1))).toBe(0);
  });
  it('counts forward to the next opening', () => {
    expect(daysUntilOpen(holiday, D(2026, 10, 25))).toBe(7); // Oct 25 → Nov 1
  });
});
