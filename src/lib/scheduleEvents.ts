// Schedule calendar — collect every dated homepage change into one flat event
// list the admin calendar can plot. Kept pure (no DB / framework) so it's
// trivially testable; the page fetches the rows and hands them in.
//
// Sources: element schedule windows (Show from / until), module auto-expiry,
// module poll & quiz close timers, and ad-campaign start/end dates.

import { parseTree, blockChain, blockLabel, type Block } from './studio';
import { windowSpansYearEnd } from './seasonal';

export type ScheduleCategory = 'element' | 'module' | 'poll' | 'quiz' | 'campaign' | 'sponsored' | 'seasonal';
export type ScheduleKind = 'up' | 'down' | 'expire' | 'close' | 'start' | 'end';

// A multi-day span (Outlook-style bar): something that runs over a window, so the
// calendar can draw a continuous bar from start to end. `status` drives styling:
// running (live now), scheduled (starts in the future), past (already ended).
export type SpanStatus = 'running' | 'scheduled' | 'past' | 'draft';
export type ScheduleSpan = {
  start: string;   // ISO 8601 — window opens
  end: string;     // ISO 8601 — window closes
  category: ScheduleCategory;
  title: string;
  detail?: string;
  status: SpanStatus;
};

export type ScheduleEvent = {
  date: string;          // ISO 8601 (UTC) — the moment it happens
  category: ScheduleCategory;
  kind: ScheduleKind;    // 'up'/'start' = something appears; the rest = it goes/changes
  title: string;         // primary label, e.g. the poll question or vendor name
  detail?: string;       // secondary label, e.g. the module it lives in
  draft?: boolean;       // not live yet (unpublished module / draft campaign) → muted
};

export type ModuleRow = { id: string; name: string; published: boolean; tree: string; expiresAt: Date | null };
export type PollRow = { question: string; createdAt: Date; closesAt: Date | null; kind: string };
export type QuizRow = { title: string; createdAt: Date; closesAt: Date | null };
export type CampaignRow = { vendorName: string; startAt: Date | null; endAt: Date | null; status: string };
export type SponsoredRow = { title: string; publishedAt: Date | null; sponsoredUntil: Date | null };
export type SeasonalRow = { label: string; moduleName: string | null; startMonth: number; startDay: number; endMonth: number; endDay: number; enabled: boolean };

export type ScheduleInput = {
  modules?: ModuleRow[];
  polls?: PollRow[];
  quizzes?: QuizRow[];
  campaigns?: CampaignRow[];
  sponsored?: SponsoredRow[];
  seasonal?: SeasonalRow[];
};

const iso = (d: Date | string): string => (typeof d === 'string' ? d : d.toISOString());

// Classify a [start,end] window relative to `now` for bar styling. `draft` (not
// yet live — unpublished element / DRAFT campaign) overrides the time-based state.
function spanStatus(start: string, end: string, now: Date, draft = false): SpanStatus {
  if (draft) return 'draft';
  const t = now.getTime();
  if (Date.parse(start) > t) return 'scheduled';
  if (Date.parse(end) <= t) return 'past';
  return 'running';
}

// Collect every dated thing that RUNS OVER A WINDOW into spanning bars: poll &
// quiz live windows (created → closes), sponsored-article featured windows
// (published → sponsored-until), ad-campaign flights, and element show-from/until
// windows. Single-moment changes (module auto-expiry, one-sided element windows)
// stay as point events in collectScheduleEvents. Skips windows with a non-positive
// duration (end <= start) so a bad row can't render a zero/negative bar.
export function collectScheduleSpans(input: ScheduleInput, now: Date = new Date()): ScheduleSpan[] {
  const spans: ScheduleSpan[] = [];
  const add = (start: Date | string | null, end: Date | string | null, category: ScheduleCategory, title: string, detail: string, draft = false) => {
    if (!start || !end) return;
    const s = iso(start), e = iso(end);
    if (!(Date.parse(e) > Date.parse(s))) return; // need a real forward window
    spans.push({ start: s, end: e, category, title, detail, status: spanStatus(s, e, now, draft) });
  };

  for (const m of input.modules ?? []) {
    const blocks: Block[] = parseTree(m.tree).children.flatMap(blockChain);
    for (const b of blocks) {
      // Only a two-sided window is a bar; a one-sided one stays a point event.
      if (b.startAt && b.endAt) add(b.startAt, b.endAt, 'element', b.label || blockLabel(b.type), m.name, !m.published);
    }
  }
  for (const p of input.polls ?? []) add(p.createdAt, p.closesAt, 'poll', p.question, p.kind === 'module' ? 'Module poll' : 'Poll');
  for (const q of input.quizzes ?? []) add(q.createdAt, q.closesAt, 'quiz', q.title, 'Pop quiz');
  for (const a of input.sponsored ?? []) add(a.publishedAt, a.sponsoredUntil, 'sponsored', a.title, 'Sponsored article');
  // Seasonal placements recur every year, so materialize each into concrete bars
  // for the years around `now` (last year for context, this year, next year) — the
  // calendar navigates within that range and spanStatus tags the live one.
  const yr = now.getFullYear();
  for (const s of input.seasonal ?? []) {
    if (!s.enabled) continue;
    const wraps = windowSpansYearEnd(s);
    for (const Y of [yr - 1, yr, yr + 1]) {
      const start = new Date(Y, s.startMonth - 1, s.startDay);
      const end = new Date(wraps ? Y + 1 : Y, s.endMonth - 1, s.endDay);
      end.setHours(23, 59, 59, 999); // include the closing day
      add(start, end, 'seasonal', s.label, s.moduleName ?? 'Seasonal module');
    }
  }
  // Ad campaigns are NOT bars — they show as start/end point markers instead (see
  // collectScheduleEvents), so a long multi-month flight doesn't eat calendar rows.

  return spans.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

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
