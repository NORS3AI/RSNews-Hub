// Schedule calendar — collect every dated homepage change into one flat event
// list the admin calendar can plot. Kept pure (no DB / framework) so it's
// trivially testable; the page fetches the rows and hands them in.
//
// Sources: element schedule windows (Show from / until), module auto-expiry,
// module poll & quiz close timers, and ad-campaign start/end dates.

import { parseTree, blockChain, blockLabel, type Block } from './studio';

export type ScheduleCategory = 'element' | 'module' | 'poll' | 'quiz' | 'campaign';
export type ScheduleKind = 'up' | 'down' | 'expire' | 'close' | 'start' | 'end';

export type ScheduleEvent = {
  date: string;          // ISO 8601 (UTC) — the moment it happens
  category: ScheduleCategory;
  kind: ScheduleKind;    // 'up'/'start' = something appears; the rest = it goes/changes
  title: string;         // primary label, e.g. the poll question or vendor name
  detail?: string;       // secondary label, e.g. the module it lives in
  draft?: boolean;       // not live yet (unpublished module / draft campaign) → muted
};

export type ModuleRow = { id: string; name: string; published: boolean; tree: string; expiresAt: Date | null };
export type PollRow = { question: string; closesAt: Date | null; kind: string };
export type QuizRow = { title: string; closesAt: Date | null };
export type CampaignRow = { vendorName: string; startAt: Date | null; endAt: Date | null; status: string };

export type ScheduleInput = {
  modules?: ModuleRow[];
  polls?: PollRow[];
  quizzes?: QuizRow[];
  campaigns?: CampaignRow[];
};

const iso = (d: Date | string): string => (typeof d === 'string' ? d : d.toISOString());

export function collectScheduleEvents(input: ScheduleInput): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  for (const m of input.modules ?? []) {
    // Element windows — scan the whole priority stack so a scheduled fallback
    // rung shows up too.
    const blocks: Block[] = parseTree(m.tree).children.flatMap(blockChain);
    for (const b of blocks) {
      const label = b.label || blockLabel(b.type);
      if (b.startAt) events.push({ date: b.startAt, category: 'element', kind: 'up', title: label, detail: m.name, draft: !m.published });
      if (b.endAt) events.push({ date: b.endAt, category: 'element', kind: 'down', title: label, detail: m.name, draft: !m.published });
    }
    // Whole-module auto-expiry (only meaningful once it's live).
    if (m.published && m.expiresAt) events.push({ date: iso(m.expiresAt), category: 'module', kind: 'expire', title: m.name, detail: 'Module retires' });
  }

  for (const p of input.polls ?? []) {
    if (p.closesAt) events.push({ date: iso(p.closesAt), category: 'poll', kind: 'close', title: p.question, detail: p.kind === 'module' ? 'Module poll closes' : 'Poll closes' });
  }
  for (const q of input.quizzes ?? []) {
    if (q.closesAt) events.push({ date: iso(q.closesAt), category: 'quiz', kind: 'close', title: q.title, detail: 'Quiz closes' });
  }
  for (const c of input.campaigns ?? []) {
    const draft = c.status === 'DRAFT' || c.status === 'CANCELLED';
    if (c.startAt) events.push({ date: iso(c.startAt), category: 'campaign', kind: 'start', title: c.vendorName, detail: 'Campaign starts', draft });
    if (c.endAt) events.push({ date: iso(c.endAt), category: 'campaign', kind: 'end', title: c.vendorName, detail: 'Campaign ends', draft });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// Group events by local calendar day (YYYY-MM-DD) for the month grid. The key is
// computed in the given locale/timezone on the client so days line up visually.
export function eventsByDay(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = map.get(key);
    if (arr) arr.push(e); else map.set(key, [e]);
  }
  return map;
}
