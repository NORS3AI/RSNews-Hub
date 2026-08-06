// Ad package catalog + flight scheduling math. Pure and unit-tested.
//
// The core rule: no creative is ever live longer than one FLIGHT, and a flight is
// a flat 90 DAYS (see FLIGHT_DAYS). Packages are chains of 90-day flights, so
// every run is identical and predictable rather than varying with calendar
// months. A campaign carries an explicit start AND end, so seasonal/holiday
// windows (e.g. Sept 1 → Dec 31) work too — flights fill the span in ≤90-day
// chunks (the last may be shorter).
//
// NOTE: the flat-90 model is a deliberate product call and may be revisited. It's
// DATA — change FLIGHT_DAYS and the `days` figures below and the whole system
// (ends, flights, reminders, calendar) follows. Adding a package is a new entry
// here, not a code change.

// One flight (and the "3-month" unit) expressed as a fixed day count.
export const FLIGHT_DAYS = 90;

export type AdPlan = {
  key: string;
  label: string;
  days: number;          // default total length in DAYS; ignored when `seasonal`
  flightDays: number;    // max a creative stays up before fresh ads are required
  allowsVideo: boolean;
  seasonal?: boolean;    // custom start/end (e.g. a holiday window)
  description: string;
};

export const AD_PLANS: AdPlan[] = [
  { key: 'quarter', label: '90-Day', days: 90, flightDays: FLIGHT_DAYS, allowsVideo: false, description: 'One 90-day flight of rotating ads.' },
  { key: 'half', label: '180-Day', days: 180, flightDays: FLIGHT_DAYS, allowsVideo: false, description: 'Two back-to-back 90-day flights — fresh ads for the second.' },
  { key: 'annual', label: '360-Day', days: 360, flightDays: FLIGHT_DAYS, allowsVideo: false, description: 'Four 90-day flights — fresh ads each flight.' },
  { key: 'premium', label: 'Premium (video)', days: 360, flightDays: FLIGHT_DAYS, allowsVideo: true, description: '360-day run that includes video ad space.' },
  { key: 'holiday', label: 'Holiday / Seasonal', days: 120, flightDays: FLIGHT_DAYS, allowsVideo: false, seasonal: true, description: 'Custom seasonal window (e.g. Sept–Dec) — set the exact dates when creating.' },
];

export const planByKey = (key: string): AdPlan | undefined => AD_PLANS.find((p) => p.key === key);

/** Add whole days to a date. */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000);
}

/** Add whole months to a date (clamping day-of-month so Jan 31 + 1mo = Feb 28/29).
 *  Retained for callers that still think in months (e.g. a seasonal default end). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** The campaign end for a plan given its start (undefined for seasonal — admin sets it). */
export function planEnd(plan: AdPlan, startAt: Date): Date | undefined {
  return plan.seasonal ? undefined : addDays(startAt, plan.days);
}

export type FlightWindow = { index: number; startAt: Date; endAt: Date };

/**
 * Split [startAt, endAt) into consecutive flights of at most `flightDays`. The
 * final flight is truncated to `endAt`, so any span (including a custom holiday
 * window) is covered without a creative ever exceeding one flight.
 */
export function generateFlights(startAt: Date, endAt: Date, flightDays = FLIGHT_DAYS): FlightWindow[] {
  const flights: FlightWindow[] = [];
  let cursor = new Date(startAt.getTime());
  let index = 1;
  // Guard against a non-positive span or runaway loops.
  while (cursor < endAt && index <= 24) {
    const next = addDays(cursor, flightDays);
    const flightEnd = next < endAt ? next : endAt;
    flights.push({ index, startAt: new Date(cursor.getTime()), endAt: flightEnd });
    cursor = flightEnd;
    index++;
  }
  return flights;
}

/** Whole days remaining until `endAt` from `now` (0 once ended). For countdowns. */
export function daysLeft(endAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endAt.getTime() - now.getTime()) / 86_400_000));
}

/** A short human countdown label, e.g. "2 months left", "5 days left", "ended". */
export function countdownLabel(endAt: Date, now: Date): string {
  const days = daysLeft(endAt, now);
  if (days <= 0) return 'ended';
  if (days === 1) return '1 day left';
  if (days < 45) return `${days} days left`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} left`;
}
