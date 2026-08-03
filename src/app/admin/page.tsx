import Link from 'next/link';
import { countArticles, listArticles, listCategories } from '@/lib/articles';
import { countUsers } from '@/lib/users';
import { listPages } from '@/lib/pages';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="card p-5 transition-shadow hover:shadow-md">
      <div className="text-3xl font-black text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </Link>
  );
}

export default function AdminDashboard() {
  const published = countArticles({ status: 'published' });
  const drafts = countArticles({ status: 'draft' });
  const archived = countArticles({ status: 'archived' });
  const trashed = countArticles({ status: 'trashed' });
  const users = countUsers();
  const categories = listCategories().length;
  const pages = listPages().length;
  const recent = listArticles({
    status: ['draft', 'published', 'archived', 'trashed'],
    orderBy: 'created_at',
    limit: 6,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
        <Link href="/admin/articles/new" className="btn-primary">
          ＋ New article
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Published" value={published} href="/admin/articles?status=published" />
        <Stat label="Drafts" value={drafts} href="/admin/articles?status=draft" />
        <Stat label="Archived" value={archived} href="/admin/articles?status=archived" />
        <Stat label="Trashed" value={trashed} href="/admin/articles?status=trashed" />
        <Stat label="Users" value={users} href="/admin/users" />
        <Stat label="Categories" value={categories} href="/admin/categories" />
        <Stat label="Pages" value={pages} href="/admin/pages" />
      </div>

      <div className="card mt-8">
        <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">
          Recently created articles
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No articles yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3">
                <Link
                  href={`/admin/articles/${a.id}/edit`}
                  className="font-medium text-slate-800 hover:text-brand-700"
                >
                  {a.title}
                </Link>
                <StatusBadge value={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
