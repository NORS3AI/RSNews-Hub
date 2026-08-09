import { loadEvents } from './analytics/query';
import { aggregateOverview, aggregateAds, aggregateThemes, advertiserReport, advertiserList, ctr } from './analytics/metrics';
import { loadDailySeries } from './analytics/rollup';

// Assembles a configurable report: the whole site, or one advertiser, over a
// range. Each section declares which visualizations it supports; the builder /
// export pages render the admin's chosen one. Reuses the same aggregations the
// Analytics page runs on, so numbers always agree.

export type Viz = 'stats' | 'bar' | 'pie' | 'table' | 'trend';
export type Slice = { key: string; count: number };
export type Stat = { label: string; value: string; sub?: string };
export type TableCol = { key: string; label: string; type?: 'text' | 'int' | 'num' | 'pct01' | 'ms' };
export type TableData = { columns: TableCol[]; rows: Record<string, string | number>[] };

export type ReportSection = {
  id: string; title: string;
  allowed: Viz[]; defaultViz: Viz;
  stats?: Stat[];
  slices?: Slice[];
  trend?: { points: number[]; label: string; value: string; sub?: string };
  table?: TableData;
};

export type ReportData = {
  scope: 'site' | 'advertiser';
  title: string; subtitle: string;
  days: number; brand?: string;
  sections: ReportSection[];
};

export const RANGES = [7, 30, 90, 180, 365, 3650] as const;
export const rangeLabel = (d: number) =>
  d >= 3650 ? 'Lifetime' : d === 365 ? 'Last 12 months' : d === 180 ? 'Last 6 months' : `Last ${d} days`;

const nf = (n: number) => Number(n).toLocaleString();
const pctStr = (v: number) => `${Math.round(v * 100)}%`;

export type ReportParams = { scope: 'site' | 'advertiser'; days: number; brand: string; hide: string[]; vizMap: Record<string, string> };

/** Parse the shared report querystring (used by the builder + the export). */
export function parseReportParams(sp: Record<string, string | string[] | undefined>): ReportParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const scope = one(sp.scope) === 'advertiser' ? 'advertiser' : 'site';
  const d = Number(one(sp.days));
  const days = (RANGES as readonly number[]).includes(d) ? d : 30;
  const brand = one(sp.brand);
  const hideStr = one(sp.hide);
  const hide = hideStr ? hideStr.split(',').filter(Boolean) : [];
  const vizMap: Record<string, string> = {};
  const vizStr = one(sp.viz);
  if (vizStr) for (const pair of vizStr.split(',')) { const [k, v] = pair.split(':'); if (k && v) vizMap[k] = v; }
  return { scope, days, brand, hide, vizMap };
}

/** Serialize report params back to a querystring (for the export link). */
export function reportQuery(p: ReportParams): string {
  const q = new URLSearchParams();
  q.set('scope', p.scope);
  q.set('days', String(p.days));
  if (p.scope === 'advertiser' && p.brand) q.set('brand', p.brand);
  if (p.hide.length) q.set('hide', p.hide.join(','));
  const viz = Object.entries(p.vizMap).map(([k, v]) => `${k}:${v}`).join(',');
  if (viz) q.set('viz', viz);
  return q.toString();
}

/** All advertiser brands seen in the range (for the scope picker). */
export async function reportAdvertisers(days: number): Promise<string[]> {
  const { events } = await loadEvents(days);
  return advertiserList(events);
}

export async function buildReport(scope: 'site' | 'advertiser', days: number, brand?: string): Promise<ReportData> {
  const { events } = await loadEvents(days);

  if (scope === 'advertiser' && brand) {
    const r = advertiserReport(events, brand);
    const adCols: TableCol[] = [
      { key: 'key', label: 'Name', type: 'text' },
      { key: 'impressions', label: 'Impressions', type: 'int' },
      { key: 'viewable', label: 'Viewable', type: 'int' },
      { key: 'clicks', label: 'Clicks', type: 'int' },
      { key: 'ctr', label: 'CTR', type: 'pct01' },
    ];
    const sections: ReportSection[] = [
      {
        id: 'ad_stats', title: 'Totals', allowed: ['stats'], defaultViz: 'stats',
        stats: [
          { label: 'Impressions', value: nf(r.totals.impressions) },
          { label: 'Viewable', value: nf(r.totals.viewable) },
          { label: 'Clicks', value: nf(r.totals.clicks) },
          { label: 'CTR', value: pctStr(r.totals.ctr), sub: 'clicks ÷ viewable' },
        ],
      },
      {
        id: 'ad_trend', title: 'Impressions over time', allowed: ['trend', 'table'], defaultViz: 'trend',
        trend: { points: r.trend.map((t) => t.impressions), label: 'Impressions', value: nf(r.totals.impressions), sub: rangeLabel(days) },
        table: { columns: [{ key: 'key', label: 'Day', type: 'text' }, { key: 'impressions', label: 'Impr.', type: 'int' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }], rows: r.trend },
      },
      {
        id: 'ad_creative', title: 'By creative', allowed: ['bar', 'table'], defaultViz: 'table',
        slices: r.byCreative.map((c) => ({ key: c.key, count: c.impressions })),
        table: { columns: adCols, rows: r.byCreative },
      },
      {
        id: 'ad_placement', title: 'By placement', allowed: ['pie', 'bar', 'table'], defaultViz: 'pie',
        slices: r.byPlacement.map((c) => ({ key: c.key, count: c.impressions })),
        table: { columns: adCols, rows: r.byPlacement },
      },
    ];
    return { scope, brand, days, title: brand, subtitle: `Advertiser performance · ${rangeLabel(days)}`, sections };
  }

  // ── Whole-site ──────────────────────────────────────────────────────────
  const ov = aggregateOverview(events);
  const adsByBrand = aggregateAds(events, 'campaign');
  const adTotals = adsByBrand.reduce((s, a) => ({ imp: s.imp + a.impressions, view: s.view + a.viewable, clk: s.clk + a.clicks }), { imp: 0, view: 0, clk: 0 });
  const themes = aggregateThemes(events);
  const series = await loadDailySeries(new Date(), days);

  const sections: ReportSection[] = [
    {
      id: 'overview', title: 'Overview', allowed: ['stats'], defaultViz: 'stats',
      stats: [
        { label: 'Pageviews', value: nf(ov.pageviews) },
        { label: 'Visitors', value: nf(ov.visitors) },
        { label: 'Article opens', value: nf(ov.articleOpens) },
        { label: 'Ad CTR', value: pctStr(ctr(adTotals.clk, adTotals.view || adTotals.imp)), sub: 'clicks ÷ viewable' },
      ],
    },
    {
      id: 'traffic', title: 'Traffic over time', allowed: ['trend', 'table'], defaultViz: 'trend',
      trend: { points: series.map((d) => d.pageviews), label: 'Pageviews', value: nf(ov.pageviews), sub: rangeLabel(days) },
      table: { columns: [{ key: 'date', label: 'Day', type: 'text' }, { key: 'pageviews', label: 'Pageviews', type: 'int' }, { key: 'visitors', label: 'Visitors', type: 'int' }, { key: 'articleOpens', label: 'Opens', type: 'int' }], rows: series as unknown as Record<string, string | number>[] },
    },
    {
      id: 'devices', title: 'Devices', allowed: ['pie', 'bar', 'table'], defaultViz: 'pie',
      slices: ov.byDevice,
      table: { columns: [{ key: 'key', label: 'Device', type: 'text' }, { key: 'count', label: 'Pageviews', type: 'int' }], rows: ov.byDevice },
    },
    {
      id: 'pages', title: 'By page type', allowed: ['bar', 'pie', 'table'], defaultViz: 'bar',
      slices: ov.byPage,
      table: { columns: [{ key: 'key', label: 'Page', type: 'text' }, { key: 'count', label: 'Pageviews', type: 'int' }], rows: ov.byPage },
    },
    {
      id: 'themes', title: 'Theme usage', allowed: ['pie', 'bar', 'table'], defaultViz: 'pie',
      slices: themes.rows.map((t) => ({ key: t.label, count: t.users })),
      table: { columns: [{ key: 'label', label: 'Theme', type: 'text' }, { key: 'users', label: 'Readers', type: 'int' }], rows: themes.rows.map((t) => ({ label: t.label, users: t.users })) },
    },
    {
      id: 'advertisers', title: 'Advertisers', allowed: ['bar', 'table'], defaultViz: 'table',
      slices: adsByBrand.map((a) => ({ key: a.key, count: a.impressions })),
      table: { columns: [{ key: 'key', label: 'Advertiser', type: 'text' }, { key: 'impressions', label: 'Impressions', type: 'int' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }], rows: adsByBrand },
    },
  ];
  return { scope, days, title: 'Whole-site report', subtitle: `Site analytics · ${rangeLabel(days)}`, sections };
}
