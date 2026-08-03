import Link from 'next/link';
import { prisma } from '@/lib/db';
import { setPageStatus, deletePage } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import { Plus } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const statusColor: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700', DRAFT: 'bg-gray-100 text-gray-600', TRASHED: 'bg-red-100 text-red-700',
};

export default async function AdminPages() {
  const pages = await prisma.page.findMany({ orderBy: { updatedAt: 'desc' } });
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pages</h1>
        <Link href="/admin/pages/new" className="btn-primary btn-sm"><Plus width={16} height={16} /> New page</Link>
      </div>
      <div className="card divide-y divide-[var(--border)]">
        {pages.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link href={`/admin/pages/${p.id}`} className="font-medium hover:text-brand-600">{p.title}</Link>
              <div className="text-xs text-[var(--muted)]">/docs/page/{p.slug} · updated {formatDate(p.updatedAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${statusColor[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
              <ActionButtons actions={[
                p.status === 'PUBLISHED'
                  ? { label: 'Unpublish', run: setPageStatus.bind(null, p.id, 'DRAFT') }
                  : { label: 'Publish', run: setPageStatus.bind(null, p.id, 'PUBLISHED') },
                { label: 'Delete', run: deletePage.bind(null, p.id), danger: true, confirm: `Delete page "${p.title}"?` },
              ]} />
            </div>
          </div>
        ))}
        {pages.length === 0 && <div className="p-6 text-[var(--muted)]">No pages yet.</div>}
      </div>
    </div>
  );
}
