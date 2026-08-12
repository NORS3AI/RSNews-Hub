import { prisma } from './db';

// Optional auto-archive: an admin sets a max age (in months) for PUBLISHED
// articles; anything older is flipped to ARCHIVED. Archived articles still
// surface via recommendations/throwbacks (see RECOMMENDABLE_STATUSES) — they
// just leave the "current" surfaces (Latest / hero / Published this week).
// Lazy sweep, called on homepage render, throttled so it runs at most ~twice/day.

const KEY = 'auto_archive_months';
const LAST = 'auto_archive_last_run';
const THROTTLE_MS = 12 * 60 * 60 * 1000;

/** Configured max age in months; 0 = off. */
export async function getAutoArchiveMonths(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 1200) : 0;
}

/** Archive PUBLISHED articles older than the configured age. Returns the count
 *  archived this run (0 when off, throttled, or nothing was old enough). */
export async function sweepAutoArchivedArticles(): Promise<number> {
  const months = await getAutoArchiveMonths();
  if (!months) return 0;

  const last = await prisma.setting.findUnique({ where: { key: LAST } });
  const lastMs = last ? Date.parse(last.value) : NaN;
  if (Number.isFinite(lastMs) && Date.now() - lastMs < THROTTLE_MS) return 0;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  // Never auto-archive a story an admin explicitly pinned or featured to keep it
  // prominent — the pin is a deliberate override of the age rule. (Scheduled
  // future-dated rows are already safe: their publishedAt is > cutoff.)
  const res = await prisma.article.updateMany({
    where: { status: 'PUBLISHED', publishedAt: { lt: cutoff }, pinned: false, featured: false },
    data: { status: 'ARCHIVED' },
  });
  const nowIso = new Date().toISOString();
  await prisma.setting.upsert({ where: { key: LAST }, update: { value: nowIso }, create: { key: LAST, value: nowIso } });
  if (res.count > 0) {
    await prisma.adminLog.create({
      data: { kind: 'articles_auto_archived', message: `Auto-archived ${res.count} article(s) older than ${months} month(s). They stay recommendable; they just left the current surfaces.` },
    });
  }
  return res.count;
}
