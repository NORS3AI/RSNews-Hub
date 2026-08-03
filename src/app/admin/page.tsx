import Link from 'next/link';
import { prisma } from '@/lib/db';
import { FileText, Users, Layers, Eye, Plus } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [published, drafts, trashed, users, categories, totalViews, recent, topArticles] = await Promise.all([
    prisma.article.count({ where: { status: 'PUBLISHED' } }),
    prisma.article.count({ where: { status: 'DRAFT' } }),
    prisma.article.count({ where: { status: 'TRASHED' } }),
    prisma.user.count(),
    prisma.category.count(),
    prisma.article.aggregate({ _sum: { views: true } }),
    prisma.article.findMany({ orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, title: true, slug: true, status: true, updatedAt: true, views: true } }),
    prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: { views: 'desc' }, take: 5, select: { id: true, title: true, slug: true, views: true } }),
  ]);

  const stats = [
    { label: 'Published', value: published, icon: FileText, href: '/admin/articles?status=PUBLISHED' },
    { label: 'Drafts', value: drafts, icon: FileText, href: '/admin/articles?status=DRAFT' },
    { label: 'Total views', value: totalViews._sum.views ?? 0, icon: Eye, href: '/admin/articles' },
    { label: 'Users', value: users, icon: Users, href: '/admin/users' },
    { label: 'Categories', value: categories, icon: Layers, href: '/admin/categories' },
    { label: 'In trash', value: trashed, icon: FileText, href: '/admin/articles?status=TRASHED' },
  ];

  const statusColor: Record<string, string> = {
    PUBLISHED: 'bg-green-100 text-green-700', DRAFT: 'bg-gray-100 text-gray-600',
    ARCHIVED: 'bg-amber-100 text-amber-700', TRASHED: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/admin/articles/new" className="btn-primary btn-sm"><Plus width={16} height={16} /> New article</Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition-shadow hover:shadow-md">
            <s.icon width={18} height={18} className="text-brand-600" />
            <div className="mt-2 text-2xl font-bold">{s.value.toLocaleString()}</div>
            <div className="text-xs text-[var(--muted)]">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Recently updated</h2>
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/articles/${a.id}`} className="line-clamp-1 text-sm font-medium hover:text-brand-600">{a.title}</Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge ${statusColor[a.status]}`}>{a.status}</span>
                  <span className="hidden text-xs text-[var(--muted)] sm:inline">{formatDate(a.updatedAt)}</span>
                </div>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-sm text-[var(--muted)]">No articles yet.</li>}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Most read</h2>
          <ul className="divide-y divide-[var(--border)]">
            {topArticles.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--bg-soft)] text-xs font-bold">{i + 1}</span>
                <Link href={`/docs/article/${a.slug}`} className="line-clamp-1 flex-1 text-sm hover:text-brand-600">{a.title}</Link>
                <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted)]"><Eye width={13} height={13} />{a.views}</span>
              </li>
            ))}
            {topArticles.length === 0 && <li className="py-2 text-sm text-[var(--muted)]">No data yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
