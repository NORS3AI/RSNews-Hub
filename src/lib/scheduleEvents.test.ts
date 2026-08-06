import { describe, it, expect } from 'vitest';
import { collectScheduleEvents, eventsByDay } from './scheduleEvents';
import { serializeTree, normalizeTree } from './studio';

const tree = (children: any[]) => serializeTree(normalizeTree({ shape: 'column', children }));

describe('collectScheduleEvents', () => {
  it('emits up/down events from element windows, muted for draft modules', () => {
    const events = collectScheduleEvents({
      modules: [
        { id: 'm1', name: 'Live Mod', published: true, expiresAt: null,
          tree: tree([{ type: 'poll', settings: { pollId: 'p' }, label: 'Weekly poll', startAt: '2026-08-20T19:00:00Z', endAt: '2026-08-25T19:00:00Z' }]) },
        { id: 'm2', name: 'Draft Mod', published: false, expiresAt: null,
          tree: tree([{ type: 'ad', settings: {}, startAt: '2026-08-22T00:00:00Z' }]) },
      ],
    });
    const up = events.filter((e) => e.kind === 'up');
    const down = events.filter((e) => e.kind === 'down');
    expect(up).toHaveLength(2);
    expect(down).toHaveLength(1);
    expect(events.find((e) => e.title === 'Weekly poll' && e.kind === 'up')?.draft).toBe(false);
    expect(events.find((e) => e.detail === 'Draft Mod')?.draft).toBe(true);
  });

  it('includes module expiry only for published modules', () => {
    const events = collectScheduleEvents({
      modules: [
        { id: 'a', name: 'Pub', published: true, expiresAt: new Date('2026-09-01T00:00:00Z'), tree: tree([]) },
        { id: 'b', name: 'Unpub', published: false, expiresAt: new Date('2026-09-01T00:00:00Z'), tree: tree([]) },
      ],
    });
    const expiries = events.filter((e) => e.kind === 'expire');
    expect(expiries).toHaveLength(1);
    expect(expiries[0].title).toBe('Pub');
  });

  it('includes poll/quiz closes and campaign start/end', () => {
    const events = collectScheduleEvents({
      polls: [{ question: 'Best tool?', closesAt: new Date('2026-08-30T00:00:00Z'), kind: 'module' }],
      quizzes: [{ title: 'Safety quiz', closesAt: new Date('2026-08-28T00:00:00Z') }],
      campaigns: [{ vendorName: 'Acme', startAt: new Date('2026-08-01T00:00:00Z'), endAt: new Date('2026-11-01T00:00:00Z'), status: 'ACTIVE' }],
    });
    expect(events.some((e) => e.category === 'poll' && e.kind === 'close')).toBe(true);
    expect(events.some((e) => e.category === 'quiz' && e.kind === 'close')).toBe(true);
    expect(events.filter((e) => e.category === 'campaign').map((e) => e.kind).sort()).toEqual(['end', 'start']);
  });

  it('sorts by date and groups by local day', () => {
    const events = collectScheduleEvents({
      quizzes: [
        { title: 'B', closesAt: new Date('2026-08-25T10:00:00Z') },
        { title: 'A', closesAt: new Date('2026-08-20T10:00:00Z') },
      ],
    });
    expect(events.map((e) => e.title)).toEqual(['A', 'B']); // sorted ascending
    const byDay = eventsByDay(events);
    expect([...byDay.values()].flat()).toHaveLength(2);
  });
});
