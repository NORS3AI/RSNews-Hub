import { prisma } from '@/lib/db';
import { EVENT_TYPES, type ClientEvent } from './types';

const MAX_BATCH = 60;
const VALID = new Set<string>(EVENT_TYPES);

// Coarse device class from a User-Agent string.
export function deviceFromUA(ua: string | null): string {
  const s = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s) || (/android/.test(s) && !/mobile/.test(s))) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return 'mobile';
  return 'desktop';
}

type Ctx = { visitorId: string | null; userId: string | null; device: string };

const MAX_PROPS_CHARS = 4000;
// Serialize event props to a string that is ALWAYS valid JSON (or null). The old
// code byte-sliced the serialized string at a cap, which could cut mid-token and
// produce invalid JSON — readers then `JSON.parse`-failed and silently dropped
// EVERY prop (skewing aggregates: a read losing `milestone` counted as finished,
// an impression losing `campaignId` dropped its brand attribution). We instead
// drop oversized props wholesale rather than store corrupt JSON.
export function serializeProps(props: unknown): string | null {
  if (!props) return null;
  let s: string;
  try { s = JSON.stringify(props); } catch { return null; }
  if (!s) return null;
  return s.length <= MAX_PROPS_CHARS ? s : null;
}

// Validate + persist a batch of client events. Unknown/invalid rows are dropped
// rather than failing the whole batch (analytics must never break a page).
export async function recordEvents(events: unknown, ctx: Ctx): Promise<number> {
  if (!Array.isArray(events)) return 0;
  const staged = events
    .slice(0, MAX_BATCH)
    .filter((e): e is ClientEvent => !!e && typeof e === 'object' && VALID.has((e as ClientEvent).type))
    .map((e) => ({
      type: String(e.type),
      subjectType: str(e.subjectType, 24),
      subjectId: str(e.subjectId, 200),
      sessionId: str(e.sessionId, 64),
      pageType: str(e.pageType, 32),
      placement: str(e.placement, 64),
      path: str(e.path, 400),
      value: typeof e.value === 'number' && isFinite(e.value) ? e.value : null,
      props: (e.props && typeof e.props === 'object' ? { ...(e.props as Record<string, unknown>) } : undefined) as Record<string, unknown> | undefined,
    }));

  // Ad attribution is decided by the SERVER, never the client. Advertiser reports
  // key on props.campaignId/brand (see metrics.brandOf); a beacon is client-
  // controlled, so a forged one could otherwise credit/poison any advertiser's
  // numbers. Resolve the real brand from the ad's own row (by subjectId = Ad.id),
  // overwrite the client-claimed brand/campaign/flight, and DROP any ad event whose
  // subjectId isn't a real ad. So the reports derive from the DB, not the browser.
  const adIds = [...new Set(staged.filter((r) => r.subjectType === 'ad' && r.subjectId).map((r) => r.subjectId as string))];
  const adById = new Map<string, { brand: string; flightId: string | null }>();
  if (adIds.length) {
    const ads = await prisma.ad.findMany({ where: { id: { in: adIds } }, select: { id: true, brand: true, flightId: true } });
    for (const a of ads) adById.set(a.id, { brand: a.brand, flightId: a.flightId });
  }

  const rows = staged
    .filter((r) => {
      if (r.subjectType !== 'ad') return true;
      const ad = r.subjectId ? adById.get(r.subjectId) : undefined;
      if (!ad) return false; // unknown / forged ad id — never counts toward a report
      const p = (r.props ??= {});
      p.brand = ad.brand;       // authoritative — overwrite whatever the client sent
      p.campaignId = ad.brand;
      if (ad.flightId) p.flightId = ad.flightId; else delete p.flightId;
      return true;
    })
    .map((r) => ({
      type: r.type,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      visitorId: ctx.visitorId,
      userId: ctx.userId,
      sessionId: r.sessionId,
      pageType: r.pageType,
      placement: r.placement,
      path: r.path,
      device: ctx.device,
      value: r.value,
      props: serializeProps(r.props),
    }));
  if (!rows.length) return 0;
  await prisma.analyticsEvent.createMany({ data: rows });
  return rows.length;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
