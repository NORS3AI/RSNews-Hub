import { prisma } from '@/lib/db';
import { collectScheduleEvents } from '@/lib/scheduleEvents';
import ScheduleCalendar from '@/components/admin/ScheduleCalendar';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const [modules, polls, quizzes, campaigns] = await Promise.all([
    prisma.customModule.findMany({ select: { id: true, name: true, published: true, tree: true, expiresAt: true } }),
    prisma.poll.findMany({ where: { closesAt: { not: null } }, select: { question: true, closesAt: true, kind: true } }),
    prisma.quiz.findMany({ select: { title: true, closesAt: true } }),
    prisma.adCampaign.findMany({ select: { vendorName: true, startAt: true, endAt: true, status: true } }),
  ]);

  const events = collectScheduleEvents({ modules, polls, quizzes, campaigns });

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Schedule</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Everything dated that changes the homepage — element windows (Show from / until), module auto-expiry, poll &amp; quiz timers, and ad-campaign start/end — on one calendar, so nothing lands as a surprise.
      </p>
      <ScheduleCalendar events={events} initialYear={now.getFullYear()} initialMonth={now.getMonth()} todayKey={todayKey} />
    </div>
  );
}
