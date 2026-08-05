'use client';
import { useMemo, useState } from 'react';
import { eventsByDay, type ScheduleEvent, type ScheduleCategory, type ScheduleKind } from '@/lib/scheduleEvents';
import { ArrowLeft, ArrowRight } from '@/components/icons';

// One palette per category, so a glance tells you what kind of change it is.
const CAT: Record<ScheduleCategory, { label: string; dot: string; chip: string }> = {
  element:  { label: 'Element window', dot: 'bg-brand-500',  chip: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900' },
  module:   { label: 'Module expiry',  dot: 'bg-rose-500',   chip: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
  poll:     { label: 'Poll closes',    dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900' },
  quiz:     { label: 'Quiz closes',    dot: 'bg-sky-500',    chip: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  campaign: { label: 'Ad campaign',    dot: 'bg-emerald-500',chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
};
// ↑ = something appears; the rest mean it leaves / changes.
const MARK: Record<ScheduleKind, string> = { up: '↑', start: '↑', down: '↓', expire: '✕', close: '⧗', end: '↓' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function ScheduleCalendar({ events, initialYear, initialMonth, todayKey }: {
  events: ScheduleEvent[]; initialYear: number; initialMonth: number; todayKey: string;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-indexed
  const byDay = useMemo(() => eventsByDay(events), [events]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const goToday = () => {
    const [ty, tm] = todayKey.split('-').map(Number);
    setYear(ty); setMonth(tm - 1);
  };

  const monthCount = events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
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
        <span className="text-sm text-[var(--muted)]">{monthCount} change{monthCount === 1 ? '' : 's'} this month</span>
        {/* Legend */}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {(Object.keys(CAT) as ScheduleCategory[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-[var(--muted)]">
              <span className={`h-2.5 w-2.5 rounded-full ${CAT[c].dot}`} /> {CAT[c].label}
            </span>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      {/* Day grid */}
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[92px] rounded-lg border border-transparent" />;
          const key = dayKey(year, month, day);
          const list = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={i} className={`min-h-[92px] rounded-lg border p-1.5 ${isToday ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20' : 'border-[var(--border)] bg-[var(--card)]'}`}>
              <div className={`mb-1 text-right text-xs font-bold ${isToday ? 'text-brand-700 dark:text-brand-300' : 'text-[var(--muted)]'}`}>{day}</div>
              <div className="space-y-1">
                {list.slice(0, 4).map((e, k) => (
                  <div key={k} title={`${MARK[e.kind]} ${e.title}${e.detail ? ` — ${e.detail}` : ''}`}
                    className={`truncate rounded border px-1.5 py-0.5 text-[11px] font-medium ${CAT[e.category].chip} ${e.draft ? 'opacity-50' : ''}`}>
                    <span className="mr-0.5 font-bold">{MARK[e.kind]}</span>{e.title}
                  </div>
                ))}
                {list.length > 4 && <div className="px-1 text-[10px] font-semibold text-[var(--muted)]">+{list.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-2)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nothing scheduled yet. Give an element a <strong>Show from / until</strong> window in the Module Studio, set a poll or quiz timer, or add an ad campaign — it&apos;ll appear here.
        </p>
      )}
    </div>
  );
}
