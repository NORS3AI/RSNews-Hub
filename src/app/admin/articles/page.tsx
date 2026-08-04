import Link from 'next/link';
import { prisma } from '@/lib/db';
import { setArticleStatus, deleteArticle } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import { Plus, Eye } from '@/components/icons';
import { formatDate } from '@/lib/utils';
import { CONTENT_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const statusColor: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700', DRAFT: 'bg-gray-100 text-gray-600',
  ARCHIVED: 'bg-amber-100 text-amber-700', TRASHED: 'bg-red-100 text-red-700',
};

const isScheduled = (a: { status: string; publishedAt: Date | null }) =>
  a.status === 'PUBLISHED' && !!a.publishedAt && new Date(a.publishedAt) > new Date();

export default async function AdminArticles(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const status = searchParams.status && CONTENT_STATUSES.includes(searchParams.status as any) ? searchParams.status : undefined;

  const [articles, counts] = await Promise.all([
    prisma.article.findMany({
      where: status ? { status } : {},
      orderBy: { updatedAt: 'desc' },
      include: { category: { select: { name: true, color: true } }, author: { select: { name: true } } },
    }),
    prisma.article.groupBy({ by: ['status'], _count: true }),
  ]);
  const countBy = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((n, c) => n + c._count, 0);

  const filters = [
    { key: undefined, label: 'All', n: total },
    ...CONTENT_STATUSES.map((s) => ({ key: s, label: s[0] + s.slice(1).toLowerCase(), n: countBy(s) })),
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Articles</h1>
        <Link href="/admin/articles/new" className="btn-primary btn-sm"><Plus width={16} height={16} /> New article</Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f.label} href={f.key ? `/admin/articles?status=${f.key}` : '/admin/articles'}
            className={`badge border px-3 py-1.5 ${status === f.key ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950' : 'border-[var(--border)] hover:bg-[var(--bg-soft)]'}`}>
            {f.label} <span className="ml-1 text-[var(--muted)]">{f.n}</span>
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Views</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {articles.map((a) => (
                <tr key={a.id} className="hover:bg-[var(--bg-soft)]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/articles/${a.id}`} className="font-medium hover:text-brand-600">{a.title}</Link>
                    {a.featured && <span className="ml-2 badge bg-brand-100 text-brand-700">Featured</span>}
                    <div className="text-xs text-[var(--muted)]">by {a.author?.name ?? 'Unknown'}</div>
                  </td>
                  <td className="px-4 py-3">{a.category ? <span style={{ color: a.category.color }}>{a.category.name}</span> : <span className="text-[var(--muted)]">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColor[a.status]}`}>{a.status}</span>
                    {isScheduled(a) && <span className="ml-1.5 badge bg-sky-100 text-sky-700" title={formatDate(a.publishedAt!)}>Scheduled</span>}
                  </td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-[var(--muted)]"><Eye width={13} height={13} />{a.views}</span></td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(a.updatedAt)}</td>
                  <td className="px-4 py-3"><ArticleActions id={a.id} status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-[var(--border)] md:hidden">
          {articles.map((a) => (
            <div key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/articles/${a.id}`} className="font-medium hover:text-brand-600">{a.title}</Link>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`badge ${statusColor[a.status]}`}>{a.status}</span>
                  {isScheduled(a) && <span className="badge bg-sky-100 text-sky-700">Scheduled</span>}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {a.category?.name ?? 'Uncategorized'} · {a.views} views · {formatDate(a.updatedAt)}
              </div>
              <div className="mt-3"><ArticleActions id={a.id} status={a.status} /></div>
            </div>
          ))}
        </div>

        {articles.length === 0 && <div className="p-8 text-center text-[var(--muted)]">No articles here.</div>}
      </div>
    </div>
  );
}

function ArticleActions({ id, status }: { id: string; status: string }) {
  const actions = [] as { label: string; run: () => Promise<any>; danger?: boolean; confirm?: string }[];
  if (status !== 'PUBLISHED') actions.push({ label: 'Publish', run: setArticleStatus.bind(null, id, 'PUBLISHED') });
  if (status === 'PUBLISHED') actions.push({ label: 'Unpublish', run: setArticleStatus.bind(null, id, 'DRAFT') });
  if (status !== 'ARCHIVED') actions.push({ label: 'Archive', run: setArticleStatus.bind(null, id, 'ARCHIVED') });
  if (status !== 'TRASHED') actions.push({ label: 'Trash', run: setArticleStatus.bind(null, id, 'TRASHED') });
  else actions.push({ label: 'Restore', run: setArticleStatus.bind(null, id, 'DRAFT') });
  if (status === 'TRASHED') actions.push({ label: 'Delete', run: deleteArticle.bind(null, id), danger: true, confirm: 'Permanently delete this article? This cannot be undone.' });
  return <ActionButtons actions={actions} />;
}
