import { prisma } from '@/lib/db';
import { saveCategory, deleteCategory } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Categories</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Add, rename, recolour or delete the categories used across the site. Changes apply everywhere immediately.</p>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Add */}
        <form action={saveCategory} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">Add a category</h2>
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" placeholder="e.g. Bulletin" /></div>
          <div><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" className="input min-h-[70px]" placeholder="Optional" /></div>
          <div><label className="label" htmlFor="color">Colour</label><input id="color" name="color" type="color" defaultValue="#4a5568" className="h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] p-1" /></div>
          <button className="btn-primary w-full">Add category</button>
        </form>

        {/* Edit / delete — each row is directly editable, no expanding needed. */}
        <div className="space-y-2 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="font-semibold">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</h2>
          </div>
          {categories.map((c) => (
            <form key={c.id} action={saveCategory} className="card flex flex-wrap items-center gap-2.5 p-3">
              <input type="hidden" name="id" value={c.id} />
              <input name="color" type="color" defaultValue={c.color} title="Colour" className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] p-0.5" />
              <input name="name" required defaultValue={c.name} aria-label="Name" className="input h-9 w-full shrink-0 font-semibold sm:w-44" />
              <input name="description" defaultValue={c.description ?? ''} placeholder="Description (optional)" aria-label="Description" className="input h-9 min-w-[140px] flex-1" />
              <span className="shrink-0 whitespace-nowrap text-xs text-[var(--muted)]">{c._count.articles} article{c._count.articles === 1 ? '' : 's'}</span>
              <button className="btn-primary btn-sm shrink-0">Save</button>
              <ActionButtons actions={[{ label: 'Delete', run: deleteCategory.bind(null, c.id), danger: true, confirm: `Delete "${c.name}"? It will be removed from any articles using it (their other categories stay).` }]} />
            </form>
          ))}
          {categories.length === 0 && <p className="text-[var(--muted)]">No categories yet — add one on the left.</p>}
        </div>
      </div>
    </div>
  );
}
