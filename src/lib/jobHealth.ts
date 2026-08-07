import { prisma } from './db';

// The scheduled jobs the hub depends on. Each is a cron-protected endpoint that
// only runs if an external scheduler hits it — so if none is wired up, nothing
// errors, it just silently stops. We record each successful run and surface it on
// the admin dashboard so a stalled (or never-configured) scheduler is visible.
export const JOBS = [
  { key: 'ads-maintenance', label: 'Ad maintenance', detail: 'Ends elapsed flights, completes campaigns, sends fresh-ads + renewal emails.', endpoint: 'POST /api/ads/maintenance', staleHours: 36 },
  { key: 'newsletter', label: 'Daily newsletter', detail: 'Sends the daily Industry News digest to subscribers.', endpoint: 'POST /api/cron/newsletter', staleHours: 36 },
  { key: 'analytics-rollup', label: 'Analytics rollup', detail: 'Aggregates raw events into the reporting tables.', endpoint: 'POST /api/analytics/rollup', staleHours: 36 },
  { key: 'article-audio', label: 'Article audio', detail: 'Generates "Listen to article" MP3s for pending articles (ElevenLabs).', endpoint: 'POST /api/cron/audio', staleHours: 36 },
  { key: 'integrations-check', label: 'Integration monitor', detail: 'Checks external connections and emails admins when one goes down or recovers.', endpoint: 'POST /api/cron/integrations', staleHours: 36 },
] as const;

const settingKey = (key: string) => `job:${key}:lastRun`;

/** Stamp a successful run of a scheduled job (call at the end of its endpoint). */
export async function recordJobRun(key: string, summary?: unknown): Promise<void> {
  const value = JSON.stringify({ at: new Date().toISOString(), summary: summary ?? null });
  await prisma.setting.upsert({ where: { key: settingKey(key) }, update: { value }, create: { key: settingKey(key), value } });
}

export type JobStatus = {
  key: string; label: string; detail: string; endpoint: string;
  lastRunAt: Date | null; neverRun: boolean; stale: boolean; staleHours: number;
};

/** Health of every scheduled job, for the admin dashboard tile. */
export async function getJobHealth(now: Date = new Date()): Promise<JobStatus[]> {
  const rows = await prisma.setting.findMany({ where: { key: { in: JOBS.map((j) => settingKey(j.key)) } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return JOBS.map((j) => {
    let lastRunAt: Date | null = null;
    try { const raw = byKey.get(settingKey(j.key)); if (raw) { const d = new Date(JSON.parse(raw).at); if (!isNaN(d.getTime())) lastRunAt = d; } } catch { /* ignore */ }
    const neverRun = !lastRunAt;
    const stale = !!lastRunAt && now.getTime() - lastRunAt.getTime() > j.staleHours * 3600_000;
    return { key: j.key, label: j.label, detail: j.detail, endpoint: j.endpoint, lastRunAt, neverRun, stale, staleHours: j.staleHours };
  });
}
