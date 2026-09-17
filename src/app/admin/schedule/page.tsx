import { prisma } from '@/lib/db';
import { collectScheduleEvents, collectScheduleSpans } from '@/lib/scheduleEvents';
import { listSeasonalSchedules } from '@/lib/seasonalServer';
import ScheduleCalendar from '@/components/admin/ScheduleCalendar';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const [modules, polls, quizzes, campaigns, sponsored, seasonalRows] = await Promise.all([
    prisma.customModule.findMany({ select: { id: true, name: true, published: true, tree: true, expiresAt: true } }),
    prisma.poll.findMany({ where: { closesAt: { not: null } }, select: { question: true, createdAt: true, closesAt: true, kind: true } }),
    prisma.quiz.findMany({ select: { title: true, createdAt: true, closesAt: true } }),
    prisma.adCampaign.findMany({ select: { vendorName: true, startAt: true, endAt: true, status: true } }),
    // Sponsored pieces with a featured window: published → sponsored-until.
    prisma.article.findMany({
      where: { genre: 'sponsored', sponsorVendorId: { not: null }, sponsoredUntil: { not: null } },
      select: { title: true, publishedAt: true, sponsoredUntil: true },
    }),
    listSeasonalSchedules(),
  ]);
  const seasonal = seasonalRows.map((s) => ({ label: s.label, moduleName: s.moduleName, startMonth: s.startMonth, startDay: s.startDay, endMonth: s.endMonth, endDay: s.endDay, enabled: s.enabled }));

  const now = new Date();
  // Bars for things that RUN over a window (polls, quizzes, sponsored, element
  // windows). Point markers for the rest: ad-campaign start/end (kept as markers,
  // by request, so a multi-month flight doesn't eat calendar rows) and module
  // auto-expiry (a single moment). Bars and markers never cover the same item.
  const spans = collectScheduleSpans({ modules, polls, quizzes, sponsored, seasonal }, now);
  const events = collectScheduleEvents({ modules, campaigns }).filter((e) => e.kind === 'expire' || e.category === 'campaign');

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Schedule</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Everything dated on one calendar. Bars run across the days something is live — <strong>polls</strong>, <strong>quizzes</strong>, <strong>sponsored articles</strong>, <strong>seasonal modules</strong>, and element windows — so you can see at a glance what&apos;s running now and what&apos;s coming up. Ad-campaign start/end and module auto-expiry show as single markers.
      </p>
      <ScheduleCalendar events={events} spans={spans} initialYear={now.getFullYear()} initialMonth={now.getMonth()} todayKey={todayKey} />
    </div>
  );
}
