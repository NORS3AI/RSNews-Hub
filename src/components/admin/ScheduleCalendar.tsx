'use client';
import { useMemo, useState } from 'react';
import type { ScheduleEvent, ScheduleCategory, ScheduleSpan } from '@/lib/scheduleEvents';
import { ArrowLeft, ArrowRight } from '@/components/icons';

// One hue per category, so a glance tells you what kind of thing is running.
const CAT: Record<ScheduleCategory, { label: string; bar: string; dot: string }> = {
  poll:      { label: 'Poll',             bar: 'bg-violet-500',  dot: 'bg-violet-500' },
  quiz:      { label: 'Quiz',             bar: 'bg-sky-500',     dot: 'bg-sky-500' },
  sponsored: { label: 'Sponsored article',bar: 'bg-brand-500',   dot: 'bg-brand-500' },
  campaign:  { label: 'Ad campaign',      bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  element:   { label: 'Element window',   bar: 'bg-amber-500',   dot: 'bg-amber-500' },
  module:    { label: 'Module retires',   bar: 'bg-rose-500',    dot: 'bg-rose-500' },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;
const MARK: Record<string, string> = { expire: '✕', up: '↑', down: '↓', start: '↑', end: '↓', close: '⧗' };

// Local calendar-day number (days since epoch in the viewer's timezone), so bar
// coverage lines up with the grid's local day cells regardless of the stored UTC.
const localDayNum = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / DAY_MS);
const dayKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

type Seg = { span: ScheduleSpan; first: number; last: number; leftCap: boolean; rightCap: boolean; lane: number };

export default function ScheduleCalendar({ events, spans, initialYear, initialMonth, todayKey }: {
  events: ScheduleEvent[]; spans: ScheduleSpan[]; initialYear: number; initialMonth: number; todayKey: string;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-indexed

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Flat cell list (leading/trailing nulls pad to whole weeks), then chunk to weeks.
  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = useMemo(() => {
    const out: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  // Point markers (module auto-expiry) grouped by local day.
  const pointsByDay = useMemo(() => {
    const m = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const d = new Date(e.date);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d.getFullYear(), d.getMonth(), d.getDate());
      (m.get(k) ?? m.set(k, []).get(k)!).push(e);
    }
    return m;
  }, [events]);

  const step = (delta: number) => { const d = new Date(year, month + delta, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); };
  const goToday = () => { const [ty, tm] = todayKey.split('-').map(Number); setYear(ty); setMonth(tm - 1); };

  // Assign lane-packed segments for one week (no two segments share a lane if their
  // columns overlap). Returns segments + how many lanes the week needs.
  const weekSegments = (weekDates: (Date | null)[]): { segs: Seg[]; lanes: number } => {
    const colDay = weekDates.map((d) => (d ? localDayNum(d) : null));
    const raw = spans.map((span) => {
      const sNum = localDayNum(new Date(span.start));
      const eNum = localDayNum(new Date(span.end));
      const covered = colDay.map((dn, i) => (dn != null && dn >= sNum && dn <= eNum ? i : -1)).filter((i) => i >= 0);
      if (!covered.length) return null;
      const first = covered[0], last = covered[covered.length - 1];
      return { span, first, last, leftCap: colDay[first] === sNum, rightCap: colDay[last] === eNum, lane: 0 } as Seg;
    }).filter((x): x is Seg => x !== null)
      .sort((a, b) => a.first - b.first || (b.last - b.first) - (a.last - a.first));

    const laneEnds: number[] = []; // last used column per lane
    for (const seg of raw) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] >= seg.first) lane++;
      seg.lane = lane;
      laneEnds[lane] = seg.last;
    }
    return { segs: raw, lanes: laneEnds.length };
  };

  const monthCount = spans.filter((s) => {
    const a = localDayNum(new Date(s.start)), b = localDayNum(new Date(s.end));
    const ms = localDayNum(new Date(year, month, 1)), me = localDayNum(new Date(year, month + 1, 0));
    return a <= me && b >= ms; // window overlaps this month
  }).length;

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="btn-outline btn-sm !px-2" aria-label="Previous month"><ArrowLeft width={16} height={16} /></button>
          <button onClick={() => step(1)} className="btn-outline btn-sm !px-2" aria-label="Next month"><ArrowRight width={16} height={16} /></button>
          <button onClick={goToday} className="btn-outline btn-sm">Today</button>
        </div>
        <h2 className="text-lg font-black tracking-tight">{MONTHS[month]} {year}</h2>
        <span className="text-sm text-[var(--muted)]">{monthCount} running or scheduled this month</span>
        {/* Legend — bars for windows, dots for point markers (campaign start/end, module retire) */}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {(['poll', 'quiz', 'sponsored', 'element'] as ScheduleCategory[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-[var(--muted)]">
              <span className={`h-2.5 w-4 rounded-full ${CAT[c].bar}`} /> {CAT[c].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]"><span className="h-2.5 w-4 rounded-full border border-dashed border-[var(--muted)] bg-transparent" /> scheduled</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]"><span className={`h-2.5 w-2.5 rounded-full ${CAT.campaign.dot}`} /> Campaign ↑start ↓end</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]"><span className={`h-2.5 w-2.5 rounded-full ${CAT.module.dot}`} /> Module retires</span>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>

      {/* Weeks — each a no-gap 7-col grid so bars run continuously across day columns */}
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {weeks.map((weekDates, wi) => {
          const { segs, lanes } = weekSegments(weekDates);
          const LANE_H = 22; const TOP = 26; // px: label row height + first-lane offset
          const minH = TOP + Math.max(lanes, 1) * LANE_H + 8;
          return (
            <div key={wi} className="relative grid grid-cols-7" style={{ minHeight: minH }}>
              {/* Day cells (background) */}
              {weekDates.map((d, ci) => {
                if (!d) return <div key={ci} className={`border-[var(--border)] ${ci ? 'border-l' : ''} ${wi ? 'border-t' : ''} bg-[var(--card-2)]/40`} />;
                const key = dayKey(d.getFullYear(), d.getMonth(), d.getDate());
                const isToday = key === todayKey;
                const pts = pointsByDay.get(key) ?? [];
                return (
                  <div key={ci} className={`border-[var(--border)] ${ci ? 'border-l' : ''} ${wi ? 'border-t' : ''} p-1 ${isToday ? 'bg-brand-50/50 dark:bg-brand-950/20' : 'bg-[var(--card)]'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {pts.map((e, k) => (
                        <span key={k} title={`${MARK[e.kind] ?? '•'} ${e.title}${e.detail ? ` — ${e.detail}` : ''}`}
                          className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[9px] font-black leading-none text-white ${CAT[e.category]?.dot ?? 'bg-slate-500'}`}>
                          {MARK[e.kind] ?? '•'}
                        </span>
                      ))}
                      <span className={`text-xs font-bold ${isToday ? 'text-brand-700 dark:text-brand-300' : 'text-[var(--muted)]'}`}>{d.getDate()}</span>
                    </div>
                  </div>
                );
              })}

              {/* Bars overlay — same 7-col template, no gap, aligned to the cells */}
              <div className="pointer-events-none absolute inset-x-0 grid grid-cols-7" style={{ top: TOP }}>
                {segs.map((seg, si) => {
                  const c = CAT[seg.span.category];
                  const past = seg.span.status === 'past';
                  const scheduled = seg.span.status === 'scheduled';
                  const draft = seg.span.status === 'draft';
                  const dim = past || draft;
                  return (
                    <div key={si}
                      style={{ gridColumn: `${seg.first + 1} / span ${seg.last - seg.first + 1}`, gridRow: 1, marginTop: seg.lane * LANE_H }}
                      className="pointer-events-auto px-0.5">
                      <div
                        title={`${c.label}: ${seg.span.title} · ${fmtDay(seg.span.start)}–${fmtDay(seg.span.end)}${past ? ' (ended)' : scheduled ? ' (scheduled)' : draft ? ' (not live)' : ' (running now)'}${seg.span.detail ? ` · ${seg.span.detail}` : ''}`}
                        className={[
                          'flex h-[18px] items-center truncate px-1.5 text-[11px] font-semibold text-white',
                          c.bar,
                          seg.leftCap ? 'rounded-l-full ml-0' : 'rounded-l-none',
                          seg.rightCap ? 'rounded-r-full' : 'rounded-r-none',
                          scheduled ? 'opacity-95 ring-1 ring-inset ring-white/60 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.35)_0_6px,transparent_6px_12px)]' : '',
                          dim ? 'opacity-40' : '',
                        ].join(' ')}>
                        {(seg.leftCap || seg.first === 0) && (
                          <span className="truncate">
                            {!seg.leftCap && <span className="mr-0.5">‹</span>}
                            {seg.span.title}
                          </span>
                        )}
                        {!seg.rightCap && seg.last === 6 && <span className="ml-auto pl-0.5">›</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {spans.length === 0 && events.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-2)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nothing scheduled yet. Set a poll or quiz timer, publish a sponsored article, add an ad campaign, or give an element a <strong>Show from / until</strong> window — it&apos;ll appear here as a bar across the days it runs.
        </p>
      )}
    </div>
  );
}
