import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';
import { entitlementsOf, isVendor } from '@/lib/entitlements';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  const [subs, history] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: user.id }, include: { category: true } }),
    prisma.readingLog.findMany({
      where: { userId: user.id }, orderBy: { readAt: 'desc' }, take: 12, distinct: ['articleId'],
      include: { article: { select: { title: true, slug: true, status: true } } },
    }),
  ]);

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-[var(--muted)]">{user.email}</p>
          <div className="mt-2 flex gap-2">
            <span className="badge bg-[var(--bg-soft)]">{user.role}</span>
            <span className="badge bg-green-100 text-green-700">{user.status}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isVendor(entitlementsOf(user)) && <Link href="/docs/vendor" className="btn-primary btn-sm">Ad dashboard</Link>}
          {(user.role === 'ADMIN' || user.role === 'EDITOR') && <Link href="/admin" className="btn-primary btn-sm">Admin dashboard</Link>}
          <LogoutButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Subscriptions</h2>
            <Link href="/docs/subscriptions" className="text-sm text-brand-600 hover:underline">Manage</Link>
          </div>
          {subs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">You haven&apos;t subscribed to anything yet.</p>
          ) : (
            <ul className="space-y-2">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.category?.color ?? '#316bff' }} />
                  {s.category ? <Link href={`/docs/category/${s.category.slug}`} className="hover:text-brand-600">{s.category.name}</Link> : 'All articles'}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <h2 className="mb-4 font-semibold">Recently read</h2>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Your reading history will appear here.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/docs/article/${h.article.slug}`} className="line-clamp-1 hover:text-brand-600">{h.article.title}</Link>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(h.readAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
