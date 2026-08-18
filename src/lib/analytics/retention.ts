// Member activation + retention — the questions a beta exists to answer: are
// invited members showing up, doing something meaningful, and coming back?
// Pure aggregation over analytics events + the member roster (`User.createdAt`
// is each member's first-seen / provisioned date, since the mirror account is
// created on first visit). DB-free so it's unit-testable; the query layer
// (`loadMembers`) feeds it. Member metrics count signed-in accounts only —
// anonymous traffic has no durable identity to retain.

import type { Ev } from './metrics';

// A "meaningful" action — beyond a bare page load — for the activation funnel.
const ENGAGED_TYPES = new Set(['article_open', 'read', 'save', 'recommend', 'clip', 'search']);

const dayKey = (d: Date | string): string => new Date(d).toISOString().slice(0, 10);

export type MemberInfo = { id: string; createdAt: Date | string };

export type ActivationFunnel = {
  members: number;   // total provisioned member accounts (all-time)
  active: number;    // members with any event in the window
  engaged: number;   // members who took a meaningful action in the window
  returned: number;  // members active on >= 2 distinct days in the window
};

// One pass: each member's set of active days + whether they ever engaged.
function memberActivity(members: MemberInfo[], evs: Ev[]) {
  const ids = new Set(members.map((m) => m.id));
  const days = new Map<string, Set<string>>();
  const engaged = new Set<string>();
  for (const e of evs) {
    if (!e.userId || !ids.has(e.userId)) continue;
    let s = days.get(e.userId);
    if (!s) { s = new Set(); days.set(e.userId, s); }
    s.add(dayKey(e.createdAt));
    if (ENGAGED_TYPES.has(e.type)) engaged.add(e.userId);
  }
  return { days, engaged };
}

export function aggregateActivation(members: MemberInfo[], evs: Ev[]): ActivationFunnel {
  const { days, engaged } = memberActivity(members, evs);
  let returned = 0;
  for (const s of days.values()) if (s.size >= 2) returned++;
  return { members: members.length, active: days.size, engaged: engaged.size, returned };
}

export type DayRetention = { day: string; newMembers: number; returningMembers: number };

// Per-day active members, split into first-day (new) vs came-from-before
// (returning). A member counts as "new" only on the day their account was first
// provisioned; any later active day is "returning".
export function aggregateNewVsReturning(members: MemberInfo[], evs: Ev[]): DayRetention[] {
  const firstDay = new Map<string, string>();
  for (const m of members) firstDay.set(m.id, dayKey(m.createdAt));
  const byDay = new Map<string, Set<string>>();
  for (const e of evs) {
    if (!e.userId || !firstDay.has(e.userId)) continue;
    const d = dayKey(e.createdAt);
    let s = byDay.get(d);
    if (!s) { s = new Set(); byDay.set(d, s); }
    s.add(e.userId);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, ids]) => {
    let nw = 0, rt = 0;
    for (const id of ids) (firstDay.get(id) === day ? nw++ : rt++);
    return { day, newMembers: nw, returningMembers: rt };
  });
}

export type CohortReturn = { cohortSize: number; returned: number; returnRate: number };

// Of members first seen within the window (createdAt >= since), how many came
// back on a LATER day than their first — the clean "do new members stick?"
// number. Return rate is returned / cohortSize.
export function aggregateCohortReturn(members: MemberInfo[], evs: Ev[], since: Date): CohortReturn {
  const first = new Map<string, string>();
  for (const m of members) if (new Date(m.createdAt) >= since) first.set(m.id, dayKey(m.createdAt));
  const returned = new Set<string>();
  for (const e of evs) {
    if (!e.userId) continue;
    const f = first.get(e.userId);
    if (f && dayKey(e.createdAt) > f) returned.add(e.userId);
  }
  const cohortSize = first.size;
  return { cohortSize, returned: returned.size, returnRate: cohortSize ? returned.size / cohortSize : 0 };
}
