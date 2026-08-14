import { prisma } from '@/lib/db';
import { collectScheduleEvents, collectScheduleSpans } from '@/lib/scheduleEvents';
import ScheduleCalendar from '@/components/admin/ScheduleCalendar';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const [modules, polls, quizzes, campaigns, sponsored] = await Promise.all([
    prisma.customModule.findMany({ select: { id: true, name: true, published: true, tree: true, expiresAt: true } }),
    prisma.poll.findMany({ where: { closesAt: { not: null } }, select: { question: true, createdAt: true, closesAt: true, kind: true } }),
    prisma.quiz.findMany({ select: { title: true, createdAt: true, closesAt: true } }),
    prisma.adCampaign.findMany({ select: { vendorName: true, startAt: true, endAt: true, status: true } }),
    // Sponsored pieces with a featured window: published → sponsored-until.
    prisma.article.findMany({
      where: { genre: 'sponsored', sponsorVendorId: { not: null }, sponsoredUntil: { not: null } },
      select: { title: true, publishedAt: true, sponsoredUntil: true },
    }),
  ]);

  const now = new Date();
  // Bars for everything that runs over a window; the only remaining point marker
  // is module auto-expiry (a single moment with no start), so bars and dots don't
  // double up on the same poll/quiz/campaign/element.
  const spans = collectScheduleSpans({ modules, polls, quizzes, campaigns, sponsored }, now);
  const events = collectScheduleEvents({ modules }).filter((e) => e.kind === 'expire');

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Schedule</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Everything dated on one calendar. Bars run across the days something is live — <strong>polls</strong>, <strong>quizzes</strong>, <strong>sponsored articles</strong>, ad campaigns, and element windows — so you can see at a glance what&apos;s running now and what&apos;s coming up. Module auto-expiry shows as a single marker.
      </p>
      <ScheduleCalendar events={events} spans={spans} initialYear={now.getFullYear()} initialMonth={now.getMonth()} todayKey={todayKey} />
    </div>
  );
}
