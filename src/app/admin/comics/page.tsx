import { prisma } from '@/lib/db';
import { saveComic, toggleComic, deleteComic } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import AdImageInput from '@/components/admin/AdImageInput';
import { postedLabel } from '@/lib/industry';

export const dynamic = 'force-dynamic';

function toLocalInput(d?: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export default async function AdminComics() {
  const comics = await prisma.comic.findMany({ orderBy: [{ postedAt: 'desc' }] });
  const current = comics.find((c) => c.active);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Backroom Humor comics</h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        The most recent <strong>active</strong> comic shows on the homepage; the rest live in the comics archive. Upload a new one and mark it active to feature it, then archive the old one. {current && <>Currently featured: <strong>{current.title}</strong>.</>}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <form action={saveComic} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">Add a comic</h2>
          <div><label className="label">Title</label><input name="title" required className="input" placeholder="Stamps then vs now" /></div>
          <AdImageInput name="image" label="Comic image" hint="Upload the artwork (JPG/PNG) or paste a URL/path." />
          <div><label className="label">Caption (optional)</label><textarea name="caption" className="input min-h-[60px]" placeholder="Shown under the comic on the homepage." /></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked className="h-4 w-4" /> Feature on homepage (active)</label>
          <button className="btn-primary w-full">Add comic</button>
        </form>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {comics.map((c) => (
            <div key={c.id} className="card overflow-hidden p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.title} className="w-full rounded-lg" />
              <div className="px-1 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{c.title}</span>
                  {c.active ? <span className="badge bg-green-100 text-green-700">On homepage</span> : <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Archived</span>}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">{postedLabel(c.postedAt)}</div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-600">Edit</summary>
                  <form action={saveComic} className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
                    <input type="hidden" name="id" value={c.id} />
                    <div><label className="label">Title</label><input name="title" required defaultValue={c.title} className="input" /></div>
                    <AdImageInput name="image" label="Image" defaultValue={c.image} />
                    <div><label className="label">Caption</label><textarea name="caption" defaultValue={c.caption ?? ''} className="input min-h-[50px]" /></div>
                    <div><label className="label">Posted</label><input name="postedAt" type="datetime-local" defaultValue={toLocalInput(c.postedAt)} className="input" /></div>
                    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={c.active} className="h-4 w-4" /> Active</label>
                    <button className="btn-primary btn-sm w-full">Save</button>
                  </form>
                </details>
                <div className="mt-2">
                  <ActionButtons actions={[
                    c.active
                      ? { label: 'Archive', run: toggleComic.bind(null, c.id, false) }
                      : { label: 'Feature', run: toggleComic.bind(null, c.id, true) },
                    { label: 'Delete', run: deleteComic.bind(null, c.id), danger: true, confirm: `Delete "${c.title}"?` },
                  ]} />
                </div>
              </div>
            </div>
          ))}
          {comics.length === 0 && <p className="text-[var(--muted)]">No comics yet. Add the first on the left.</p>}
        </div>
      </div>
    </div>
  );
}
