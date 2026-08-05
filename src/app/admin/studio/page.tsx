import { prisma } from '@/lib/db';
import { parseTree } from '@/lib/studio';
import StudioList from '@/components/admin/studio/StudioList';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const [rows, log] = await Promise.all([
    prisma.customModule.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  const modules = rows.map((r) => ({
    id: r.id,
    name: r.name,
    shape: r.shape,
    published: r.published,
    blocks: parseTree(r.tree).children.length,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Module Studio</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Build custom homepage modules block by block — pick a shape, drop in articles, ads, polls and more, then publish and place it on the homepage.
      </p>
      <StudioList modules={modules} />

      {log.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2.5 text-sm font-black uppercase tracking-[0.12em] text-[var(--muted)]">Activity log</h2>
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-card">
            {log.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>{e.message}</span>
                <time className="shrink-0 text-xs text-[var(--muted)]" dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleDateString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
