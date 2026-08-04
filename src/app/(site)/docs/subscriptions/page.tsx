import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import SubscribeButton from '@/components/SubscribeButton';
import { Bell } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscriptions' };

export default async function SubscriptionsPage() {
  const user = await getCurrentUser();
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } } },
  });

  const subs = user
    ? await prisma.subscription.findMany({ where: { userId: user.id }, select: { categoryId: true } })
    : [];
  const subbedCats = new Set(subs.map((s) => s.categoryId));
  const allSubbed = subs.some((s) => s.categoryId === null);

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6 flex items-center gap-2"><Bell className="text-brand-600" /><h1 className="text-2xl font-bold">Subscriptions</h1></div>

      {!user && (
        <div className="card mb-8 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--muted)]">Sign in to subscribe to topics and get notified about new articles.</p>
          <Link href="/login?next=/docs/subscriptions" className="btn-primary btn-sm">Sign in</Link>
        </div>
      )}

      <div className="card mb-6 flex items-center justify-between p-5">
        <div>
          <div className="font-semibold">All articles</div>
          <div className="text-sm text-[var(--muted)]">Get everything published across the Hub.</div>
        </div>
        <SubscribeButton categoryId={null} initialSubscribed={allSubbed} isAuthed={!!user} label="Subscribe" size="md" />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">By category</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-5">
            <div className="min-w-0">
              <Link href={`/docs/category/${c.slug}`} className="font-semibold hover:text-brand-600" style={{ color: c.color }}>{c.name}</Link>
              <div className="text-sm text-[var(--muted)]">{c._count.articles} articles</div>
            </div>
            <SubscribeButton categoryId={c.id} initialSubscribed={subbedCats.has(c.id)} isAuthed={!!user} label="Subscribe" />
          </div>
        ))}
      </div>
    </div>
  );
}
