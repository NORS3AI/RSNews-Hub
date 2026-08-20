import { prisma } from './db';
import { isSeasonActive, type SeasonalWindow } from './seasonal';

// Reads for the seasonal-modules feature. The homepage asks for the ids that are
// active TODAY (cheap: a handful of rows, date-checked in JS); the admin page +
// calendar list them all with their module name.

/** CustomModule ids whose enabled seasonal window is open on `now`, priority order.
 *  De-duped (a module scheduled twice only appears once). */
export async function getActiveSeasonalModuleIds(now: Date): Promise<string[]> {
  const rows = await prisma.seasonalModule.findMany({
    where: { enabled: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    select: { moduleId: true, startMonth: true, startDay: true, endMonth: true, endDay: true },
  });
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (isSeasonActive(r as SeasonalWindow, now) && !seen.has(r.moduleId)) { seen.add(r.moduleId); out.push(r.moduleId); }
  }
  return out;
}

export type SeasonalScheduleRow = {
  id: string; label: string; moduleId: string; moduleName: string | null;
  startMonth: number; startDay: number; endMonth: number; endDay: number;
  enabled: boolean; priority: number; active: boolean;
};

/** All seasonal schedules with their module name + whether they're open today. */
export async function listSeasonalSchedules(now: Date = new Date()): Promise<SeasonalScheduleRow[]> {
  const rows = await prisma.seasonalModule.findMany({ orderBy: [{ enabled: 'desc' }, { priority: 'asc' }, { createdAt: 'asc' }] });
  const ids = [...new Set(rows.map((r) => r.moduleId))];
  const mods = ids.length ? await prisma.customModule.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(mods.map((m) => [m.id, m.name]));
  return rows.map((r) => ({
    id: r.id, label: r.label, moduleId: r.moduleId, moduleName: nameById.get(r.moduleId) ?? null,
    startMonth: r.startMonth, startDay: r.startDay, endMonth: r.endMonth, endDay: r.endDay,
    enabled: r.enabled, priority: r.priority, active: r.enabled && isSeasonActive(r as SeasonalWindow, now),
  }));
}
