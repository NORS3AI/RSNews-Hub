// Audience segmentation — break engagement down by *who* the visitor is
// (account type, tenure, region, store type, signed-in vs guest, device).
//
// Kept pure and DB-free: the query layer resolves a `UserInfo` map (userId →
// attributes, with tenure pre-bucketed against "now") and hands it here alongside
// the events. Anonymous events segment as "guest".

import type { Ev } from './metrics';

export type UserInfo = { accountType: string; region: string | null; storeType: string | null; tenure: string };
export type UserInfoMap = Record<string, UserInfo>;

// The dimensions the dashboard can segment by.
export const AUDIENCE_DIMS = [
  ['accountType', 'Account type'],
  ['tenure', 'Tenure'],
  ['auth', 'Signed-in vs guest'],
  ['device', 'Device'],
  ['region', 'Region'],
  ['storeType', 'Store type'],
] as const;
export type AudienceDim = (typeof AUDIENCE_DIMS)[number][0];

/** Tenure bucket from an account's signup date relative to `now`. Pure. */
export function tenureBucket(createdAt: Date | string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000);
  if (days < 0) return '—';
  if (days < 7) return 'New (<7d)';
  if (days < 30) return '1–4 weeks';
  if (days < 90) return '1–3 months';
  if (days < 365) return '3–12 months';
  return '1 year+';
}

/** Resolve the segment value for one event under a given audience dimension. */
export function audienceSegment(e: Ev, dim: AudienceDim, users: UserInfoMap): string {
  if (dim === 'device') return e.device || '—';
  if (dim === 'auth') return e.userId ? 'Signed-in' : 'Guest';
  const info = e.userId ? users[e.userId] : undefined;
  if (!info) return 'Guest';
  switch (dim) {
    case 'accountType': return info.accountType || '—';
    case 'tenure': return info.tenure || '—';
    case 'region': return info.region || 'Unspecified';
    case 'storeType': return info.storeType || 'Unspecified';
    default: return '—';
  }
}

export type AudienceRow = {
  key: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  articleOpens: number;
  opensPerSession: number;
};

/**
 * Aggregate engagement per audience segment. Uniques (visitors/sessions) are
 * counted with sets per segment; opensPerSession is a derived ratio. Pure.
 */
export function aggregateAudience(evs: Ev[], dim: AudienceDim, users: UserInfoMap): AudienceRow[] {
  const g = new Map<string, { visitors: Set<string>; sessions: Set<string>; pv: number; opens: number }>();
  const ensure = (k: string) => {
    let v = g.get(k);
    if (!v) { v = { visitors: new Set(), sessions: new Set(), pv: 0, opens: 0 }; g.set(k, v); }
    return v;
  };
  for (const e of evs) {
    const row = ensure(audienceSegment(e, dim, users));
    if (e.visitorId) row.visitors.add(e.visitorId);
    if (e.sessionId) row.sessions.add(e.sessionId);
    if (e.type === 'pageview') row.pv++;
    else if (e.type === 'article_open') row.opens++;
  }
  return [...g.entries()]
    .map(([key, r]) => ({
      key,
      visitors: r.visitors.size,
      sessions: r.sessions.size,
      pageviews: r.pv,
      articleOpens: r.opens,
      opensPerSession: r.sessions.size ? +(r.opens / r.sessions.size).toFixed(2) : 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}
