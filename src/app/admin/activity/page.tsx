import { prisma } from '@/lib/db';
import { articleStatus, timedStatus, moduleStatus } from '@/lib/contentStatus';
import ActivityList, { type ActivityItem } from '@/components/admin/ActivityList';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const now = Date.now();
  const [articles, polls, quizzes, modules] = await Promise.all([
    prisma.article.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, title: true, slug: true, status: true, publishedAt: true, createdAt: true } }),
    prisma.poll.findMany({ where: { kind: 'council' }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, question: true, active: true, closesAt: true, createdAt: true } }),
    prisma.quiz.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, title: true, active: true, closesAt: true, createdAt: true } }),
    prisma.customModule.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, name: true, published: true, expiresAt: true, tree: true, createdAt: true } }),
  ]);

  const items: ActivityItem[] = [
    ...articles.map((a): ActivityItem => ({ id: a.id, type: 'article', title: a.title, status: articleStatus(a, now), at: a.createdAt.toISOString(), href: `/admin/articles/${a.id}` })),
    ...polls.map((p): ActivityItem => ({ id: p.id, type: 'poll', title: p.question, status: timedStatus(p, now), at: p.createdAt.toISOString(), href: '/admin/polls' })),
    ...quizzes.map((q): ActivityItem => ({ id: q.id, type: 'quiz', title: q.title, status: timedStatus(q, now), at: q.createdAt.toISOString(), href: '/admin/quizzes' })),
    ...modules.map((m): ActivityItem => ({ id: m.id, type: 'module', title: m.name, status: moduleStatus(m, now), at: m.createdAt.toISOString(), href: `/admin/studio/${m.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Recent activity</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Everything you&apos;ve created recently — articles, polls, quizzes and modules — with its status. A quick way to double-check nothing you meant to schedule is still sitting on a <strong>Draft</strong>. Filter by type below.
      </p>
      <ActivityList items={items} />
    </div>
  );
}
