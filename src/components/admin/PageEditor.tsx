'use client';
import Link from 'next/link';
import { savePage } from '@/lib/actions';
import { CONTENT_STATUSES } from '@/lib/constants';

type Page = { id: string; title: string; content: string; status: string; slug?: string };

export default function PageEditor({ page }: { page?: Page }) {
  return (
    <form action={savePage}>
      {page?.id && <input type="hidden" name="id" value={page.id} />}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{page ? 'Edit page' : 'New page'}</h1>
        <div className="flex gap-2">
          <Link href="/admin/pages" className="btn-outline btn-sm">Cancel</Link>
          <button className="btn-primary btn-sm">Save</button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required defaultValue={page?.title} className="input text-lg" placeholder="About us" /></div>
          <div><label className="label" htmlFor="content">Content (HTML)</label><textarea id="content" name="content" required defaultValue={page?.content} className="input min-h-[360px] font-mono text-sm" placeholder="<p>Page content…</p>" /></div>
        </div>
        <aside>
          <div className="card space-y-4 p-4">
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={page?.status ?? 'DRAFT'} className="input">
                {CONTENT_STATUSES.filter((s) => s !== 'ARCHIVED').map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            {page?.slug && <p className="text-xs text-[var(--muted)]">URL: <code>/docs/page/{page.slug}</code></p>}
          </div>
        </aside>
      </div>
    </form>
  );
}
