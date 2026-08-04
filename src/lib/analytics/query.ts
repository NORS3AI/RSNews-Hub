import { prisma } from '@/lib/db';
import type { Ev } from './metrics';

export function rangeDays(days: number) {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  return { since, until };
}

function safeProps(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? (o as Record<string, unknown>) : {}; } catch { return {}; }
}

// Load events in the window as plain, parsed objects for the pure aggregators.
// Capped so a runaway table can't OOM the dashboard (note the cap in the UI).
export async function loadEvents(days: number, cap = 60000): Promise<{ events: Ev[]; capped: boolean }> {
  const { since } = rangeDays(days);
  const rows = await prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: cap + 1 });
  const capped = rows.length > cap;
  const events: Ev[] = rows.slice(0, cap).map((r) => ({
    type: r.type, subjectType: r.subjectType, subjectId: r.subjectId, placement: r.placement,
    pageType: r.pageType, device: r.device, visitorId: r.visitorId, userId: r.userId,
    sessionId: r.sessionId, value: r.value, props: safeProps(r.props), createdAt: r.createdAt,
  }));
  return { events, capped };
}

export async function totalEventCount(): Promise<number> {
  return prisma.analyticsEvent.count();
}
