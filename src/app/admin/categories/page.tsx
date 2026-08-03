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
      <h1 className="mb-5 text-2xl font-bold">Categories</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <form action={saveCategory} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">Add category</h2>
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" placeholder="Product" /></div>
          <div><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" className="input min-h-[70px]" placeholder="Optional" /></div>
          <div><label className="label" htmlFor="color">Color</label><input id="color" name="color" type="color" defaultValue="#316bff" className="input h-10 p-1" /></div>
          <button className="btn-primary w-full">Add category</button>
        </form>

        <div className="space-y-3 lg:col-span-2">
          {categories.map((c) => (
            <details key={c.id} className="card p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className="text-xs text-[var(--muted)]">{c._count.articles} articles</span>
              </summary>
              <form action={saveCategory} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                <input type="hidden" name="id" value={c.id} />
                <div><label className="label">Name</label><input name="name" required defaultValue={c.name} className="input" /></div>
                <div><label className="label">Description</label><textarea name="description" defaultValue={c.description ?? ''} className="input min-h-[60px]" /></div>
                <div><label className="label">Color</label><input name="color" type="color" defaultValue={c.color} className="input h-10 p-1" /></div>
                <div className="flex items-center justify-between">
                  <button className="btn-primary btn-sm">Save</button>
                  <ActionButtons actions={[{ label: 'Delete', run: deleteCategory.bind(null, c.id), danger: true, confirm: `Delete "${c.name}"? Articles will become uncategorized.` }]} />
                </div>
              </form>
            </details>
          ))}
          {categories.length === 0 && <p className="text-[var(--muted)]">No categories yet.</p>}
        </div>
      </div>
    </div>
  );
}
