// Quarterly ad-performance reports.
//
// A report snapshots the ad analytics we already collect (impressions, viewable,
// clicks, CTR, dwell, per-creative / per-placement, daily trend) for one vendor
// over one calendar quarter. The admin auto-drafts it, reviews/edits the
// summary, and publishes; only PUBLISHED reports appear on the vendor dashboard.
// The computed numbers are frozen into `metrics` (JSON) at generation time, so a
// published report stays stable even after the raw events age out of the table.
//
// Quarter math is pure (UTC) and unit-tested; the rest is thin persistence.

import { prisma } from './db';
import { loadEventsBetween } from './analytics/query';
import { aggregateAds, adTrend } from './analytics/metrics';
import { brandKey } from './entitlements';

export type Quarter = { label: string; start: Date; end: Date };

const EMPTY_TOTALS = { key: '', impressions: 0, viewable: 0, clicks: 0, ctr: 0, expands: 0, avgDwellMs: 0, aboveFoldPct: 0 };

export type ReportSnapshot = {
  brand: string;
  totals: typeof EMPTY_TOTALS;
  byCreative: ReturnType<typeof aggregateAds>;
  byPlacement: ReturnType<typeof aggregateAds>;
  // Their embedded ad's performance inside each vendor-connected sponsored piece,
  // and per individual campaign batch (AdFlight). Keys are frozen to readable
  // labels (article title / "Batch N · dates") at generation time.
  bySponsoredArticle: ReturnType<typeof aggregateAds>;
  byBatch: ReturnType<typeof aggregateAds>;
  trend: ReturnType<typeof adTrend>;
  generatedForDays: number;
};

/** The calendar quarter (UTC) containing `d`. Q1 = Jan–Mar, … Q4 = Oct–Dec. */
export function quarterOf(d: Date): Quarter {
  const year = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3); // 0..3
  const start = new Date(Date.UTC(year, q * 3, 1));
  const end = new Date(Date.UTC(year, q * 3 + 3, 1)); // exclusive
  return { label: `Q${q + 1} ${year}`, start, end };
}

/** The most recently *completed* quarter as of `now` (reports cover finished periods). */
export function lastCompletedQuarter(now: Date): Quarter {
  const current = quarterOf(now);
  // One millisecond before this quarter began lands in the previous quarter.
  return quarterOf(new Date(current.start.getTime() - 1));
}

/** Recent quarters (most recent completed first) — options for the admin picker. */
export function recentQuarters(now: Date, count = 6): Quarter[] {
  const out: Quarter[] = [];
  let q = lastCompletedQuarter(now);
  for (let i = 0; i < count; i++) {
    out.push(q);
    q = quarterOf(new Date(q.start.getTime() - 1));
  }
  return out;
}

/** Parse a stored metrics JSON blob back into a snapshot (never throws). */
export function parseSnapshot(json: string): ReportSnapshot {
  try {
    const o = JSON.parse(json);
    return {
      brand: String(o.brand ?? ''),
      totals: { ...EMPTY_TOTALS, ...(o.totals ?? {}) },
      byCreative: Array.isArray(o.byCreative) ? o.byCreative : [],
      byPlacement: Array.isArray(o.byPlacement) ? o.byPlacement : [],
      bySponsoredArticle: Array.isArray(o.bySponsoredArticle) ? o.bySponsoredArticle : [],
      byBatch: Array.isArray(o.byBatch) ? o.byBatch : [],
      trend: Array.isArray(o.trend) ? o.trend : [],
      generatedForDays: Number(o.generatedForDays ?? 0),
    };
  } catch {
    return { brand: '', totals: EMPTY_TOTALS, byCreative: [], byPlacement: [], bySponsoredArticle: [], byBatch: [], trend: [], generatedForDays: 0 };
  }
}

/** Compute the snapshot for one vendor over a period from the raw ad events. */
export async function computeSnapshot(vendorBrandKey: string, brandLabel: string, period: Quarter): Promise<ReportSnapshot> {
  const { events } = await loadEventsBetween(period.start, period.end);
  // Scope strictly to this vendor's ad events, matched on the normalized brand
  // key (campaignId falls back to brand) — so casing/spacing can't leak or drop.
  const scoped = events.filter(
    (e) => e.subjectType === 'ad' && brandKey(String(e.props.campaignId ?? e.props.brand ?? '')) === vendorBrandKey,
  );
  // Totals fold ALL scoped ad events into one bucket (see advertiserReport) so a
  // brand typed two ways can't drop a variant from the headline number.
  const totals = { ...(aggregateAds(scoped, 'all')[0] ?? EMPTY_TOTALS), key: brandLabel };
  const byCreative = await labelCreatives(aggregateAds(scoped, 'creative'));
  // Their ad's performance inside each sponsored article, and per campaign batch.
  const articleRows = aggregateAds(scoped.filter((e) => e.props.sponsored === true), 'article');
  const batchRows = aggregateAds(scoped.filter((e) => !!e.props.flightId), 'flight');
  const bySponsoredArticle = relabel(articleRows, await articleTitles(articleRows.map((r) => r.key)), 'Removed article');
  const byBatch = relabel(batchRows, await flightLabels(batchRows.map((r) => r.key)), 'Removed batch');
  const days = Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000);
  return {
    brand: brandLabel,
    totals,
    byCreative,
    byPlacement: aggregateAds(scoped, 'placement'),
    bySponsoredArticle,
    byBatch,
    trend: adTrend(scoped),
    generatedForDays: days,
  };
}

/** Map a key→label lookup over aggregate rows, freezing the readable label into
 *  each row's `key` (a since-deleted subject keeps `missing` instead of a cuid). */
function relabel<T extends { key: string }>(rows: T[], labels: Map<string, string>, missing: string): T[] {
  return rows.map((r) => ({ ...r, key: r.key === '—' ? '—' : (labels.get(r.key) ?? missing) }));
}

/** articleId → title, for the sponsored-article breakdown. */
async function articleTitles(ids: string[]): Promise<Map<string, string>> {
  const clean = ids.filter((k) => k && k !== '—');
  if (!clean.length) return new Map();
  const arts = await prisma.article.findMany({ where: { id: { in: clean } }, select: { id: true, title: true } });
  return new Map(arts.map((a) => [a.id, (a.title || 'Untitled article').trim()]));
}

/** flightId → a readable batch label ("Batch N · Jan 1–Mar 31, 2026"). Exported
 *  so the live advertiser dashboard labels batches the same way as the report. */
export async function flightLabels(ids: string[]): Promise<Map<string, string>> {
  const clean = ids.filter((k) => k && k !== '—');
  if (!clean.length) return new Map();
  const flights = await prisma.adFlight.findMany({ where: { id: { in: clean } }, select: { id: true, index: true, startAt: true, endAt: true } });
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return new Map(flights.map((f) => [f.id, `Batch ${f.index} · ${fmt(f.startAt)}–${fmt(f.endAt)}`]));
}

/** Replace each creative row's raw id key with the ad's human headline/label,
 *  resolved once at generation and frozen into the snapshot. A creative whose Ad
 *  row was since deleted keeps a readable fallback instead of a bare cuid. */
async function labelCreatives<T extends { key: string }>(rows: T[]): Promise<T[]> {
  const ids = rows.map((r) => r.key).filter((k) => k && k !== '—');
  if (!ids.length) return rows;
  const ads = await prisma.ad.findMany({ where: { id: { in: ids } }, select: { id: true, headline: true, label: true } });
  const byId = new Map(ads.map((a) => [a.id, (a.headline || a.label || 'Untitled creative').trim()]));
  return rows.map((r) => ({ ...r, key: r.key === '—' ? '—' : (byId.get(r.key) ?? 'Removed creative') }));
}

/**
 * Auto-draft (or re-draft) a vendor's report for a period. Idempotent on
 * (vendorId, periodStart): regenerating refreshes the numbers and returns the
 * report to DRAFT for re-review, preserving the admin's summary.
 */
export async function generateReportDraft(vendorId: string, period: Quarter): Promise<string> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true, brandKey: true } });
  if (!vendor) throw new Error('Vendor not found');
  const snapshot = await computeSnapshot(vendor.brandKey, vendor.name, period);
  const metrics = JSON.stringify(snapshot);
  const report = await prisma.performanceReport.upsert({
    where: { vendorId_periodStart: { vendorId, periodStart: period.start } },
    update: { metrics, periodLabel: period.label, periodEnd: period.end, status: 'DRAFT', publishedAt: null },
    create: { vendorId, periodLabel: period.label, periodStart: period.start, periodEnd: period.end, metrics, status: 'DRAFT' },
    select: { id: true },
  });
  return report.id;
}

export async function updateReportSummary(id: string, summary: string): Promise<void> {
  await prisma.performanceReport.update({ where: { id }, data: { summary: summary.slice(0, 4000) } });
}

export async function publishReport(id: string): Promise<void> {
  await prisma.performanceReport.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
}

export async function unpublishReport(id: string): Promise<void> {
  await prisma.performanceReport.update({ where: { id }, data: { status: 'DRAFT', publishedAt: null } });
}

/** Published reports for one vendor (newest period first) — the vendor dashboard. */
export async function listPublishedReports(vendorId: string) {
  return prisma.performanceReport.findMany({
    where: { vendorId, status: 'PUBLISHED' },
    orderBy: { periodStart: 'desc' },
  });
}
