import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { listPages } from '@/lib/pages';
import { setPageStatusAction, deletePageAction } from '../actions';

export const dynamic = 'force-dynamic';

export default function AdminPagesPage() {
  const pages = listPages();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Pages</h1>
        <Link href="/admin/pages/new" className="btn-primary">
          ＋ New page
        </Link>
      </div>

      <div className="card overflow-hidden">
        {pages.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No pages yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pages/${p.id}/edit`}
                        className="font-medium text-slate-800 hover:text-brand-700"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">/p/{p.slug}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {p.status !== 'published' && (
                          <form action={setPageStatusAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="status" value="published" />
                            <button className="chip bg-brand-600 text-white hover:bg-brand-700">
                              Publish
                            </button>
                          </form>
                        )}
                        {p.status !== 'trashed' ? (
                          <form action={setPageStatusAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="status" value="trashed" />
                            <button className="chip">Trash</button>
                          </form>
                        ) : (
                          <form action={setPageStatusAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="status" value="draft" />
                            <button className="chip">Restore</button>
                          </form>
                        )}
                        <Link href={`/admin/pages/${p.id}/edit`} className="chip">
                          Edit
                        </Link>
                        <form action={deletePageAction}>
                          <input type="hidden" name="id" value={p.id} />
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
