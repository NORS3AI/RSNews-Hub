import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { listArticles } from '@/lib/articles';
import type { ArticleStatus } from '@/lib/types';
import { setArticleStatusAction, deleteArticleAction } from '../actions';

export const dynamic = 'force-dynamic';

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
  { value: 'trashed', label: 'Trash' },
];

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = 'all', q } = await searchParams;
  const statusFilter: ArticleStatus[] =
    status === 'all' ? ['draft', 'published', 'archived', 'trashed'] : [status as ArticleStatus];
  const articles = listArticles({
    status: statusFilter,
    search: q,
    orderBy: 'created_at',
    limit: 200,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Articles</h1>
        <Link href="/admin/articles/new" className="btn-primary">
          ＋ New article
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/articles?status=${f.value}`}
            className={`chip ${status === f.value ? 'bg-brand-600 text-white' : ''}`}
          >
            {f.label}
          </Link>
        ))}
        <form action="/admin/articles" method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input className="input py-1.5" name="q" defaultValue={q} placeholder="Search…" />
          <button className="btn-secondary py-1.5">Search</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        {articles.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No articles here.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articles.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/articles/${a.id}/edit`}
                        className="font-medium text-slate-800 hover:text-brand-700"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{a.category_name || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={a.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{a.views}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {a.status !== 'published' && (
                          <StatusButton id={a.id} status="published" label="Publish" tone="primary" />
                        )}
                        {a.status !== 'archived' && (
                          <StatusButton id={a.id} status="archived" label="Archive" />
                        )}
                        {a.status !== 'trashed' ? (
                          <StatusButton id={a.id} status="trashed" label="Trash" />
                        ) : (
                          <StatusButton id={a.id} status="draft" label="Restore" />
                        )}
                        <Link href={`/admin/articles/${a.id}/edit`} className="chip">
                          Edit
                        </Link>
                        <form action={deleteArticleAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="chip text-red-600 hover:bg-red-50">Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
  tone,
}: {
  id: number;
  status: string;
  label: string;
  tone?: 'primary';
}) {
  return (
    <form action={setArticleStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`chip ${tone === 'primary' ? 'bg-brand-600 text-white hover:bg-brand-700' : ''}`}>
        {label}
      </button>
    </form>
  );
}
