import { describe, it, expect } from 'vitest';
import { parseQuizBlocks, resolveClosesAt, isQuizOpen, validateAnswers } from './quiz';

describe('parseQuizBlocks', () => {
  it('parses questions separated by blank lines and marks the * option correct', () => {
    const raw = [
      'What year?',
      '*1995',
      '2001',
      '',
      'Which one?',
      'A',
      '*B',
    ].join('\n');
    const qs = parseQuizBlocks(raw);
    expect(qs).toHaveLength(2);
    expect(qs[0].prompt).toBe('What year?');
    expect(qs[0].options).toEqual([
      { label: '1995', correct: true },
      { label: '2001', correct: false },
    ]);
    expect(qs[1].options.find((o) => o.correct)?.label).toBe('B');
  });

  it('drops blocks with fewer than two options', () => {
    expect(parseQuizBlocks('Lonely prompt\nonly one option')).toHaveLength(0);
  });

  it('caps options at 8 and trims whitespace', () => {
    const opts = ['Prompt', ...Array.from({ length: 10 }, (_, i) => `  opt${i}  `)].join('\n');
    const qs = parseQuizBlocks(opts);
    expect(qs[0].options).toHaveLength(8);
    expect(qs[0].options[0].label).toBe('opt0');
  });

  it('returns empty for blank input', () => {
    expect(parseQuizBlocks('')).toEqual([]);
    expect(parseQuizBlocks('   ')).toEqual([]);
  });
});

describe('resolveClosesAt', () => {
  const from = new Date('2026-01-01T00:00:00Z').getTime();

  it('defaults to 48 hours from the base time', () => {
    expect(resolveClosesAt({ from }).toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('honors a custom hours value', () => {
    expect(resolveClosesAt({ hours: 24, from }).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('falls back to 48h for non-positive or invalid hours', () => {
    expect(resolveClosesAt({ hours: 0, from }).toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(resolveClosesAt({ hours: -5, from }).toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('prefers an explicit close date over hours', () => {
    const explicit = new Date('2026-02-01T12:00:00Z');
    expect(resolveClosesAt({ explicit, hours: 24, from }).toISOString()).toBe('2026-02-01T12:00:00.000Z');
  });

  it('ignores an invalid explicit date', () => {
    expect(resolveClosesAt({ explicit: new Date('nonsense'), hours: 24, from }).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('isQuizOpen', () => {
  const now = Date.now();
  it('is open when active and before close', () => {
    expect(isQuizOpen({ active: true, closesAt: new Date(now + 3600_000) }, now)).toBe(true);
  });
  it('is closed once the timer passes', () => {
    expect(isQuizOpen({ active: true, closesAt: new Date(now - 1000) }, now)).toBe(false);
  });
  it('is closed when inactive even if before close', () => {
    expect(isQuizOpen({ active: false, closesAt: new Date(now + 3600_000) }, now)).toBe(false);
  });
});

describe('validateAnswers', () => {
  const valid = new Map([
    ['q1', new Set(['a', 'b'])],
    ['q2', new Set(['c', 'd'])],
  ]);

  it('keeps only option ids that belong to their question', () => {
    expect(validateAnswers({ q1: 'a', q2: 'c' }, valid).sort()).toEqual(['a', 'c']);
  });

  it('drops answers to unknown questions or invalid options', () => {
    expect(validateAnswers({ q1: 'x', q9: 'a', q2: 'd' }, valid)).toEqual(['d']);
  });

  it('returns empty when nothing is valid', () => {
    expect(validateAnswers({ q1: 'z' }, valid)).toEqual([]);
    expect(validateAnswers({}, valid)).toEqual([]);
  });
});
