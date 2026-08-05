// Ad package catalog + flight scheduling math. Pure and unit-tested.
//
// The core rule: no creative is ever live longer than one FLIGHT (default 3
// months), so packages are just chains of 3-month flights. A campaign carries an
// explicit start AND end, so seasonal/holiday windows (e.g. Sept 1 → Dec 31)
// work too — flights fill the span in ≤3-month chunks (the last may be shorter).
//
// Plans are DATA: adding a package later is a new entry here, not a code change.

export type AdPlan = {
  key: string;
  label: string;
  months: number;        // default total length; ignored when `seasonal` (dates are custom)
  flightMonths: number;  // max a creative stays up before fresh ads are required
  allowsVideo: boolean;
  seasonal?: boolean;    // custom start/end (e.g. a holiday window)
  description: string;
};

export const AD_PLANS: AdPlan[] = [
  { key: 'quarter', label: '3-Month', months: 3, flightMonths: 3, allowsVideo: false, description: 'One 3-month flight of rotating ads.' },
  { key: 'half', label: '6-Month', months: 6, flightMonths: 3, allowsVideo: false, description: 'Two back-to-back 3-month flights — fresh ads for the second.' },
  { key: 'annual', label: '12-Month', months: 12, flightMonths: 3, allowsVideo: false, description: 'Four 3-month flights — fresh ads each quarter.' },
  { key: 'premium', label: 'Premium (video)', months: 12, flightMonths: 3, allowsVideo: true, description: 'Annual run that includes video ad space.' },
  { key: 'holiday', label: 'Holiday / Seasonal', months: 4, flightMonths: 3, allowsVideo: false, seasonal: true, description: 'Custom seasonal window (e.g. Sept–Dec) — set the exact dates when creating.' },
];

export const planByKey = (key: string): AdPlan | undefined => AD_PLANS.find((p) => p.key === key);

/** Add whole months to a date (clamping day-of-month so Jan 31 + 1mo = Feb 28/29). */
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
  return plan.seasonal ? undefined : addMonths(startAt, plan.months);
}

export type FlightWindow = { index: number; startAt: Date; endAt: Date };

/**
 * Split [startAt, endAt) into consecutive flights of at most `flightMonths`. The
 * final flight is truncated to `endAt`, so any span (including a 4-month holiday
 * window) is covered without a creative ever exceeding one flight.
 */
export function generateFlights(startAt: Date, endAt: Date, flightMonths = 3): FlightWindow[] {
  const flights: FlightWindow[] = [];
  let cursor = new Date(startAt.getTime());
  let index = 1;
  // Guard against a non-positive span or runaway loops.
  while (cursor < endAt && index <= 24) {
    const next = addMonths(cursor, flightMonths);
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
