import { prisma } from '@/lib/db';
import { saveTag, deleteTag } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminTags() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">Tags</h1>
      <form action={saveTag} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1"><label className="label" htmlFor="name">New tag</label><input id="name" name="name" required className="input" placeholder="tutorial" /></div>
        <button className="btn-primary">Add tag</button>
      </form>

      <div className="card divide-y divide-[var(--border)]">
        {tags.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 p-4">
            <form action={saveTag} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <span className="text-[var(--muted)]">#</span>
              <input name="name" defaultValue={t.name} className="input max-w-xs" />
              <button className="btn-outline btn-sm">Rename</button>
            </form>
            <span className="text-xs text-[var(--muted)]">{t._count.articles} articles</span>
            <ActionButtons actions={[{ label: 'Delete', run: deleteTag.bind(null, t.id), danger: true, confirm: `Delete tag "${t.name}"?` }]} />
          </div>
        ))}
        {tags.length === 0 && <div className="p-6 text-[var(--muted)]">No tags yet.</div>}
      </div>
    </div>
  );
}
