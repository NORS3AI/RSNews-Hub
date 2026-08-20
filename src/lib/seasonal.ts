// Seasonal modules — pure date logic. A seasonal placement shows a homepage module
// during a recurring yearly window defined by a start month/day and an end month/day
// (1-based). A start that sorts AFTER the end means the window wraps the New Year
// (e.g. Nov 1 → Jan 5). No DB, no React, so the homepage resolver, the calendar
// painter, and the tests all share one source of truth.

export type SeasonalWindow = {
  startMonth: number; // 1-12
  startDay: number;   // 1-31
  endMonth: number;
  endDay: number;
};

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Compare month/day as a single ordinal so windows are just numeric ranges.
const key = (month: number, day: number) => month * 100 + day;

/** Does the window wrap the New Year (start sorts after end)? */
export function windowSpansYearEnd(w: SeasonalWindow): boolean {
  return key(w.startMonth, w.startDay) > key(w.endMonth, w.endDay);
}

/** Is `date` inside the window (inclusive), ignoring the year? Handles wrap. */
export function isSeasonActive(w: SeasonalWindow, date: Date): boolean {
  const t = key(date.getMonth() + 1, date.getDate());
  const s = key(w.startMonth, w.startDay);
  const e = key(w.endMonth, w.endDay);
  return s <= e ? t >= s && t <= e : t >= s || t <= e;
}

// Max day per month (Feb = 29 so leap-year Feb 29 windows are allowed). Keeps an
// impossible date like Feb 31 from being stored, which would otherwise make the
// calendar bar (a real Date that rolls over into March) disagree with isSeasonActive.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Clamp submitted month/day into valid ranges (month 1-12, day 1-lastDayOfMonth). */
export function clampWindow(w: SeasonalWindow): SeasonalWindow {
  const cm = (n: number) => Math.min(12, Math.max(1, Math.round(n) || 1));
  const cd = (n: number, month: number) => Math.min(DAYS_IN_MONTH[month - 1], Math.max(1, Math.round(n) || 1));
  const startMonth = cm(w.startMonth), endMonth = cm(w.endMonth);
  return { startMonth, startDay: cd(w.startDay, startMonth), endMonth, endDay: cd(w.endDay, endMonth) };
}

/** "Nov 1" style label for one month/day. */
export function monthDayLabel(month: number, day: number): string {
  return `${MONTH_NAMES[Math.min(12, Math.max(1, month)) - 1]} ${day}`;
}

/** "Nov 1 – Jan 5" style label for a whole window. */
export function formatWindow(w: SeasonalWindow): string {
  return `${monthDayLabel(w.startMonth, w.startDay)} – ${monthDayLabel(w.endMonth, w.endDay)}`;
}

/**
 * Days until the window next OPENS, measured from `from` (0 = open today). Used
 * for the "opens in N days" hint on the calendar/admin. Scans forward up to ~400
 * days so it always finds the next yearly occurrence.
 */
export function daysUntilOpen(w: SeasonalWindow, from: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 400; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    // "Open today" counts as 0; otherwise the first day the window is active AND
    // the day before was not (the true opening edge).
    if (isSeasonActive(w, d)) {
      if (i === 0) return 0;
      const prev = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i - 1);
      if (!isSeasonActive(w, prev)) return i;
    }
  }
  return -1;
}
