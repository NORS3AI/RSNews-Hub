import type { Page } from '@/lib/types';

export default function PageForm({
  action,
  page,
}: {
  action: (formData: FormData) => void;
  page?: Page;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {page && <input type="hidden" name="id" value={page.id} />}
      <div className="space-y-4 lg:col-span-2">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input className="input" id="title" name="title" defaultValue={page?.title} required />
        </div>
        <div>
          <label className="label" htmlFor="body">
            Body
          </label>
          <textarea
            className="input font-mono text-sm"
            id="body"
            name="body"
            rows={18}
            defaultValue={page?.body}
          />
        </div>
      </div>
      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select className="input" id="status" name="status" defaultValue={page?.status || 'draft'}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="trashed">Trashed</option>
            </select>
          </div>
          {page && <p className="text-xs text-slate-400">Public URL: /p/{page.slug}</p>}
        </div>
        <button className="btn-primary w-full">{page ? 'Save changes' : 'Create page'}</button>
      </div>
    </form>
  );
}
