import { prisma } from '@/lib/db';
import { listSeasonalSchedules } from '@/lib/seasonalServer';
import SeasonalManager from '@/components/admin/SeasonalManager';

export const dynamic = 'force-dynamic';

// Admin → Seasonal: schedule Module Studio modules onto the homepage on a recurring
// yearly window (e.g. a holiday module Nov 1 → Jan 5). Active ones drop in high on
// the homepage automatically and lift off when the window closes — no manual layout
// changes. The windows also show on the Schedule calendar.
export default async function AdminSeasonal() {
  const [schedules, modules] = await Promise.all([
    listSeasonalSchedules(),
    prisma.customModule.findMany({ where: { published: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Seasonal modules</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        Put a Module Studio module on the homepage for a <b>recurring yearly window</b> — a holiday module every November, a back-to-school module every August. When the window opens it drops in high on the homepage automatically, and it lifts off when the window closes. Build the module with a <b>Collection</b> so it fills itself with seasonal stories, and it&apos;ll refresh every year. These windows also appear on the <b>Schedule</b> calendar.
      </p>
      <SeasonalManager schedules={schedules} modules={modules} />
    </div>
  );
}
