// Pure aggregation over parsed analytics events. No DB / server imports, so the
// whole reporting engine is unit-testable. query.ts fetches rows and hands
// plain objects here; the admin dashboard renders the results.

export type Ev = {
  type: string;
  subjectType?: string | null;
  subjectId?: string | null;
  placement?: string | null;
  pageType?: string | null;
  device?: string | null;
  visitorId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  value?: number | null;
  props: Record<string, unknown>;
  createdAt: Date | string;
};

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
export const ctr = (clicks: number, exposures: number): number => (exposures > 0 ? clicks / exposures : 0);
export const pct = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);
export const uniq = (xs: (string | null | undefined)[]): number => new Set(xs.filter(Boolean)).size;

// Resolve the value of a split dimension for one event.
export function splitDim(e: Ev, dim: string): string {
  switch (dim) {
    case 'placement': return e.placement || '—';
    case 'pageType': return e.pageType || '—';
    case 'device': return e.device || '—';
    case 'module': return String(e.props.module ?? e.placement ?? '—');
    case 'moduleType': return String(e.props.moduleType ?? '—');
    case 'hasImage': return e.props.hasImage ? 'with image' : 'no image';
    case 'position': return `slot ${num(e.props.pos)}`;
    case 'creative': return String(e.props.creativeId ?? e.subjectId ?? '—');
    case 'campaign': return String(e.props.campaignId ?? e.props.brand ?? '—');
    case 'all': return 'all'; // fold everything into one bucket (for grand totals)
    case 'format': return String(e.props.format ?? '—');
    case 'shape': return String(e.props.shape ?? '—');
    case 'category': return String(e.props.category ?? '—');
    default: return String((e.props as Record<string, unknown>)[dim] ?? '—');
  }
}

type AdRow = { key: string; impressions: number; viewable: number; clicks: number; ctr: number; expands: number; avgDwellMs: number; aboveFoldPct: number };

// Ads: exposure (impression/viewable/above-fold/dwell) + interaction (clicks) +
// how often readers opened the zoom overlay (expands — a readability signal).
export function aggregateAds(evs: Ev[], splitBy: string): AdRow[] {
  const g = new Map<string, { imp: number; view: number; clk: number; exp: number; dwell: number; dwellN: number; af: number }>();
  const ensure = (k: string) => { let v = g.get(k); if (!v) { v = { imp: 0, view: 0, clk: 0, exp: 0, dwell: 0, dwellN: 0, af: 0 }; g.set(k, v); } return v; };
  for (const e of evs) {
    if (e.subjectType !== 'ad') continue;
    const row = ensure(splitDim(e, splitBy));
    if (e.type === 'impression') {
      row.imp++;
      if (e.props.viewable) row.view++;
      if (e.props.aboveFold) row.af++;
      const d = num(e.props.dwellMs ?? e.value);
      if (d > 0) { row.dwell += d; row.dwellN++; }
    } else if (e.type === 'click') row.clk++;
    else if (e.type === 'ad_expand') row.exp++;
  }
  return [...g.entries()].map(([key, r]) => ({
    key, impressions: r.imp, viewable: r.view, clicks: r.clk,
    ctr: ctr(r.clk, r.view || r.imp), expands: r.exp,
    avgDwellMs: r.dwellN ? Math.round(r.dwell / r.dwellN) : 0, aboveFoldPct: pct(r.af, r.imp),
  })).sort((a, b) => b.impressions - a.impressions);
}

type EngRow = { key: string; impressions: number; clicks: number; ctr: number };

// Articles/modules: exposure + interaction grouped by a presentation dimension
// (module, image vs none, position, …) — the "smart compare".
export function aggregateEngagement(evs: Ev[], splitBy: string): EngRow[] {
  const g = new Map<string, { imp: number; clk: number }>();
  const ensure = (k: string) => { let v = g.get(k); if (!v) { v = { imp: 0, clk: 0 }; g.set(k, v); } return v; };
  for (const e of evs) {
    if (e.subjectType !== 'article') continue;
    const row = ensure(splitDim(e, splitBy));
    if (e.type === 'impression') row.imp++;
    else if (e.type === 'click') row.clk++;
  }
  return [...g.entries()].map(([key, r]) => ({ key, impressions: r.imp, clicks: r.clk, ctr: ctr(r.clk, r.imp) }))
    .sort((a, b) => b.impressions - a.impressions);
}

type VideoRow = { key: string; views: number; q25: number; q50: number; q75: number; q100: number; completionRate: number };

// Video ads: a playback funnel. Quartiles fire once per impression, so `views`
// = starts (quartile 0) and completionRate = finishes ÷ starts. Split by
// creative or campaign to compare which video holds attention longest.
export function aggregateVideo(evs: Ev[], splitBy: string): VideoRow[] {
  const g = new Map<string, { v: number; q25: number; q50: number; q75: number; q100: number }>();
  const ensure = (k: string) => { let r = g.get(k); if (!r) { r = { v: 0, q25: 0, q50: 0, q75: 0, q100: 0 }; g.set(k, r); } return r; };
  for (const e of evs) {
    if (e.type !== 'video' || e.subjectType !== 'ad') continue;
    const row = ensure(splitDim(e, splitBy));
    switch (num(e.props.quartile)) {
      case 0: row.v++; break;
      case 25: row.q25++; break;
      case 50: row.q50++; break;
      case 75: row.q75++; break;
      case 100: row.q100++; break;
    }
  }
  return [...g.entries()].map(([key, r]) => ({
    key, views: r.v, q25: r.q25, q50: r.q50, q75: r.q75, q100: r.q100, completionRate: pct(r.q100, r.v),
  })).sort((a, b) => b.views - a.views);
}

// Reading outcomes per article: opens, unique readers, avg active time, and how
// far people scrolled.
export function aggregateReading(evs: Ev[]) {
  const opens = evs.filter((e) => e.type === 'article_open');
  // Finalized reads carry activeMs + the max scrollPct reached (one per read).
  const reads = evs.filter((e) => e.type === 'read' && e.props.milestone == null);
  const activeMs = reads.map((e) => num(e.props.activeMs ?? e.value)).filter((n) => n > 0);
  const scrolls = reads.map((e) => num(e.props.scrollPct)).filter((n) => n > 0);
  // Reach = share of reads whose *max* scroll depth crossed each mark (so one
  // read counts at most once per bucket — never >100%).
  const denom = reads.length || 1;
  const reached = (m: number) => reads.filter((e) => num(e.props.scrollPct) >= m).length;
  return {
    opens: opens.length,
    uniqueReaders: uniq(opens.map((e) => e.visitorId)),
    avgActiveMs: activeMs.length ? Math.round(activeMs.reduce((a, b) => a + b, 0) / activeMs.length) : 0,
    avgScrollPct: scrolls.length ? Math.round(scrolls.reduce((a, b) => a + b, 0) / scrolls.length) : 0,
    reach: { 25: pct(reached(25), denom), 50: pct(reached(50), denom), 75: pct(reached(75), denom), 100: pct(reached(100), denom) },
    bounces: reads.filter((e) => num(e.props.activeMs ?? e.value) < 5000).length,
  };
}

// Clippings funnel + action mix.
export function aggregateClips(evs: Ev[]) {
  const clips = evs.filter((e) => e.type === 'clip');
  const by = (a: string) => clips.filter((e) => e.props.action === a);
  const saves = by('save');
  return {
    saves: saves.length,
    savers: uniq(saves.map((e) => e.visitorId)),
    byKind: { comic: saves.filter((e) => e.props.kind === 'comic').length, quote: saves.filter((e) => e.props.kind === 'quote').length },
    downloads: by('download').length,
    deletes: by('delete').length,
    expands: by('expand').length,
    copies: by('copy').length,
    opens: by('open').length,
  };
}

// Top-level hub engagement.
export function aggregateOverview(evs: Ev[]) {
  const pv = evs.filter((e) => e.type === 'pageview');
  const sessions = uniq(evs.map((e) => e.sessionId));
  const opens = evs.filter((e) => e.type === 'article_open');
  const visitors = uniq(evs.map((e) => e.visitorId));
  const byDevice = tally(evs.filter((e) => e.type === 'pageview'), (e) => e.device || 'unknown');
  const byPage = tally(pv, (e) => e.pageType || 'other');
  return {
    pageviews: pv.length,
    visitors,
    loggedInVisitors: uniq(evs.filter((e) => e.userId).map((e) => e.visitorId)),
    sessions,
    articleOpens: opens.length,
    opensPerSession: sessions ? +(opens.length / sessions).toFixed(2) : 0,
    byDevice, byPage,
  };
}

// ---- Advertiser-scoped reporting (a vendor sees only their own brand) ----

const brandOf = (e: Ev): string => String(e.props.campaignId ?? e.props.brand ?? '');
// Match key for a brand string — trim + lowercase, mirroring lib/entitlements'
// brandKey. Kept inline so this module stays DB/import-free and unit-testable.
// Ensures the admin "Build report" hand-off (which passes the vendor's *display
// name*) still matches events keyed on campaignId/brand across casing/whitespace.
const brandMatchKey = (s: unknown): string => (typeof s === 'string' ? s.trim() : String(s ?? '')).toLowerCase();

// Distinct advertiser/brand names present in the ad events.
export function advertiserList(evs: Ev[]): string[] {
  const s = new Set<string>();
  for (const e of evs) if (e.subjectType === 'ad') { const b = brandOf(e); if (b) s.add(b); }
  return [...s].sort((a, b) => a.localeCompare(b));
}

// Impressions/clicks per day for the given (already brand-filtered) ad events.
export function adTrend(evs: Ev[]): { key: string; impressions: number; clicks: number; ctr: number }[] {
  const g = new Map<string, { imp: number; clk: number }>();
  for (const e of evs) {
    if (e.subjectType !== 'ad') continue;
    const key = new Date(e.createdAt).toISOString().slice(0, 10);
    let r = g.get(key); if (!r) { r = { imp: 0, clk: 0 }; g.set(key, r); }
    if (e.type === 'impression') r.imp++; else if (e.type === 'click') r.clk++;
  }
  return [...g.entries()].map(([key, r]) => ({ key, impressions: r.imp, clicks: r.clk, ctr: ctr(r.clk, r.imp) })).sort((a, b) => (a.key < b.key ? -1 : 1));
}

// Full report for one advertiser — totals + per-creative + per-placement +
// daily trend, scoped strictly to that brand's events.
export function advertiserReport(evs: Ev[], brand: string) {
  const key = brandMatchKey(brand);
  const ads = evs.filter((e) => e.subjectType === 'ad' && brandMatchKey(brandOf(e)) === key);
  // Totals fold ALL of the brand's ad events into one bucket. (Splitting by
  // 'campaign' and taking [0] would keep only the largest spelling variant when a
  // brand was entered two ways — undercounting, and disagreeing with byCreative.)
  const totals = aggregateAds(ads, 'all')[0] ?? { key: brand, impressions: 0, viewable: 0, clicks: 0, ctr: 0, expands: 0, avgDwellMs: 0, aboveFoldPct: 0 };
  return { brand, totals, byCreative: aggregateAds(ads, 'creative'), byPlacement: aggregateAds(ads, 'placement'), trend: adTrend(ads) };
}

export function tally<T>(items: T[], keyFn: (t: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) { const k = keyFn(it); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

// Theme usage: which UI mode people actually browse in. We count each distinct
// actor (signed-in userId, else the anonymous visitorId, else the session) once,
// by their MOST RECENT theme signal in the window — so a reader who switches
// Light→RS lands in RS, not both. `switches` counts deliberate toggles.
const THEME_LABELS: Record<string, string> = { light: 'Light', dark: 'Dark', rs: 'RS Mode' };
export function aggregateThemes(evs: Ev[]): {
  rows: { theme: string; label: string; users: number; pct: number }[];
  totalUsers: number;
  switches: number;
} {
  const latest = new Map<string, { theme: string; at: number }>();
  let switches = 0;
  for (const e of evs) {
    if (e.type !== 'theme') continue;
    const theme = String(e.props.theme ?? '');
    if (theme !== 'light' && theme !== 'dark' && theme !== 'rs') continue;
    if (e.props.reason === 'switch') switches++;
    const actor = e.userId || e.visitorId || e.sessionId;
    if (!actor) continue;
    const at = new Date(e.createdAt).getTime();
    const prev = latest.get(actor);
    if (!prev || at >= prev.at) latest.set(actor, { theme, at });
  }
  const counts: Record<string, number> = { light: 0, dark: 0, rs: 0 };
  for (const { theme } of latest.values()) counts[theme] = (counts[theme] ?? 0) + 1;
  const totalUsers = latest.size;
  const rows = (['light', 'dark', 'rs'] as const).map((t) => ({
    theme: t, label: THEME_LABELS[t], users: counts[t], pct: totalUsers ? counts[t] / totalUsers : 0,
  }));
  return { rows, totalUsers, switches };
}
