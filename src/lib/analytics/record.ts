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

// Validate + persist a batch of client events. Unknown/invalid rows are dropped
// rather than failing the whole batch (analytics must never break a page).
export async function recordEvents(events: unknown, ctx: Ctx): Promise<number> {
  if (!Array.isArray(events)) return 0;
  const rows = events
    .slice(0, MAX_BATCH)
    .filter((e): e is ClientEvent => !!e && typeof e === 'object' && VALID.has((e as ClientEvent).type))
    .map((e) => {
      const props = e.props && typeof e.props === 'object' ? e.props : undefined;
      return {
        type: String(e.type),
        subjectType: str(e.subjectType, 24),
        subjectId: str(e.subjectId, 200),
        visitorId: ctx.visitorId,
        userId: ctx.userId,
        sessionId: str(e.sessionId, 64),
        pageType: str(e.pageType, 32),
        placement: str(e.placement, 64),
        path: str(e.path, 400),
        device: ctx.device,
        value: typeof e.value === 'number' && isFinite(e.value) ? e.value : null,
        props: props ? JSON.stringify(props).slice(0, 4000) : null,
      };
    });
  if (!rows.length) return 0;
  await prisma.analyticsEvent.createMany({ data: rows });
  return rows.length;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
