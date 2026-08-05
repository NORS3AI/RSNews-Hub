import { describe, it, expect } from 'vitest';
import { quarterOf, lastCompletedQuarter, recentQuarters, parseSnapshot } from './reports';

const iso = (d: Date) => d.toISOString();

describe('quarterOf', () => {
  it('maps a date to its calendar quarter (UTC, end exclusive)', () => {
    const q = quarterOf(new Date('2026-05-14T10:00:00Z'));
    expect(q.label).toBe('Q2 2026');
    expect(iso(q.start)).toBe('2026-04-01T00:00:00.000Z');
    expect(iso(q.end)).toBe('2026-07-01T00:00:00.000Z');
  });
  it('handles quarter boundaries', () => {
    expect(quarterOf(new Date('2026-01-01T00:00:00Z')).label).toBe('Q1 2026');
    expect(quarterOf(new Date('2026-12-31T23:59:59Z')).label).toBe('Q4 2026');
    expect(iso(quarterOf(new Date('2026-10-01T00:00:00Z')).end)).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('lastCompletedQuarter', () => {
  it('returns the quarter before the one containing now', () => {
    expect(lastCompletedQuarter(new Date('2026-05-14T00:00:00Z')).label).toBe('Q1 2026');
  });
  it('rolls back across the year boundary', () => {
    expect(lastCompletedQuarter(new Date('2026-01-10T00:00:00Z')).label).toBe('Q4 2025');
  });
  it('a date on the first instant of a quarter counts the prior quarter as last-completed', () => {
    expect(lastCompletedQuarter(new Date('2026-04-01T00:00:00Z')).label).toBe('Q1 2026');
  });
});

describe('recentQuarters', () => {
  it('lists N completed quarters, most recent first, contiguous', () => {
    const qs = recentQuarters(new Date('2026-05-14T00:00:00Z'), 4);
    expect(qs.map((q) => q.label)).toEqual(['Q1 2026', 'Q4 2025', 'Q3 2025', 'Q2 2025']);
    // each quarter's start is the previous one's end
    for (let i = 0; i < qs.length - 1; i++) expect(iso(qs[i].start)).toBe(iso(qs[i + 1].end));
  });
});

describe('parseSnapshot', () => {
  it('round-trips a valid snapshot', () => {
    const snap = parseSnapshot(JSON.stringify({ brand: 'PackWise', totals: { impressions: 10, clicks: 2 }, byCreative: [{ key: 'a' }], trend: [] }));
    expect(snap.brand).toBe('PackWise');
    expect(snap.totals.impressions).toBe(10);
    expect(snap.totals.clicks).toBe(2);
    expect(snap.byCreative).toHaveLength(1);
  });
  it('never throws on garbage — returns an empty snapshot', () => {
    const snap = parseSnapshot('not json');
    expect(snap.brand).toBe('');
    expect(snap.totals.impressions).toBe(0);
    expect(snap.byCreative).toEqual([]);
  });
});
