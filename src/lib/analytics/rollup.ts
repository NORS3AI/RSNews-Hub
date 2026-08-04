// Daily rollups + retention. Pre-aggregating events per UTC day powers the
// trends view AND lets us prune old raw events without losing history.
//
// The `computeDay` / `bucketByDay` functions are pure (no DB) and unit-tested;
// the server functions upsert rollup rows, prune old events, and read back the
// series for the dashboard.

import { prisma } from '@/lib/db';
import type { Ev } from './metrics';

export type DayAgg = {
  events: number;
  pageviews: number;
  visitors: number;
  sessions: number;
  articleOpens: number;
  reads: number;
  adImpressions: number;
  adViewable: number;
  adClicks: number;
  clipSaves: number;
};

const empty = (): DayAgg => ({
  events: 0, pageviews: 0, visitors: 0, sessions: 0, articleOpens: 0,
  reads: 0, adImpressions: 0, adViewable: 0, adClicks: 0, clipSaves: 0,
});

/** UTC calendar day ('YYYY-MM-DD') for a timestamp. */
export function dayKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** Aggregate a single day's events into one DayAgg. Pure. */
export function computeDay(evs: Ev[]): DayAgg {
  const a = empty();
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  for (const e of evs) {
    a.events++;
    if (e.visitorId) visitors.add(e.visitorId);
    if (e.sessionId) sessions.add(e.sessionId);
    switch (e.type) {
      case 'pageview': a.pageviews++; break;
      case 'article_open': a.articleOpens++; break;
      case 'read': if (e.props.milestone == null) a.reads++; break;
      case 'clip': if (e.props.action === 'save') a.clipSaves++; break;
    }
    if (e.subjectType === 'ad') {
      if (e.type === 'impression') { a.adImpressions++; if (e.props.viewable) a.adViewable++; }
      else if (e.type === 'click') a.adClicks++;
    }
  }
  a.visitors = visitors.size;
  a.sessions = sessions.size;
  return a;
}

/** Group events into per-UTC-day aggregates. Pure. */
export function bucketByDay(evs: Ev[]): Map<string, DayAgg> {
  const byDay = new Map<string, Ev[]>();
  for (const e of evs) {
    const k = dayKey(e.createdAt);
    const arr = byDay.get(k); if (arr) arr.push(e); else byDay.set(k, [e]);
  }
  const out = new Map<string, DayAgg>();
  for (const [k, arr] of byDay) out.set(k, computeDay(arr));
  return out;
}

/**
 * Decide which raw events are prunable: those strictly older than the retention
 * cutoff. Returns the cutoff Date, or null when retention is disabled (≤0).
 * Pure — the policy is unit-tested; the server function does the delete.
 */
export function retentionCutoff(now: Date, retentionDays: number): Date | null {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return null;
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function retentionDays(): number {
  const n = Number(process.env.ANALYTICS_RETENTION_DAYS);
  return Number.isFinite(n) ? n : 365; // default: keep a year of raw events; 0 disables pruning
}

// ---- Server-side (DB) helpers ----

const rowFromAgg = (date: string, a: DayAgg) => ({ date, ...a });

/** Rebuild rollup rows for the given UTC day keys from raw events (idempotent). */
export async function rollupDays(dates: string[]): Promise<number> {
  for (const date of dates) {
    const since = new Date(`${date}T00:00:00.000Z`);
    const until = new Date(since.getTime() + 24 * 60 * 60 * 1000);
    const rows = await prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since, lt: until } },
      select: { type: true, subjectType: true, visitorId: true, sessionId: true, value: true, props: true, createdAt: true },
    });
    const evs: Ev[] = rows.map((r) => ({
      type: r.type, subjectType: r.subjectType, visitorId: r.visitorId, sessionId: r.sessionId,
      value: r.value, props: safeProps(r.props), createdAt: r.createdAt,
    }));
    const agg = computeDay(evs);
    const data = rowFromAgg(date, agg);
    await prisma.analyticsDaily.upsert({ where: { date }, create: data, update: data });
  }
  return dates.length;
}

/** The last N UTC day keys, oldest→newest, ending today. */
export function recentDayKeys(now: Date, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  return keys;
}

/** Delete raw events older than the retention cutoff. Returns rows removed. */
export async function pruneOldEvents(now: Date): Promise<{ pruned: number; cutoff: string | null }> {
  const cutoff = retentionCutoff(now, retentionDays());
  if (!cutoff) return { pruned: 0, cutoff: null };
  const res = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { pruned: res.count, cutoff: cutoff.toISOString() };
}

/** Read the rollup series for the dashboard, oldest→newest, filling gaps with zeros. */
export async function loadDailySeries(now: Date, days: number): Promise<Array<{ date: string } & DayAgg>> {
  const keys = recentDayKeys(now, days);
  const rows = await prisma.analyticsDaily.findMany({ where: { date: { in: keys } } });
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return keys.map((date) => {
    const r = byDate.get(date);
    return { date, ...(r ? aggFromRow(r) : empty()) };
  });
}

function aggFromRow(r: { events: number; pageviews: number; visitors: number; sessions: number; articleOpens: number; reads: number; adImpressions: number; adViewable: number; adClicks: number; clipSaves: number }): DayAgg {
  return {
    events: r.events, pageviews: r.pageviews, visitors: r.visitors, sessions: r.sessions,
    articleOpens: r.articleOpens, reads: r.reads, adImpressions: r.adImpressions,
    adViewable: r.adViewable, adClicks: r.adClicks, clipSaves: r.clipSaves,
  };
}

function safeProps(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? (o as Record<string, unknown>) : {}; } catch { return {}; }
}
