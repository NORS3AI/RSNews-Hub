import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Layers } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } } },
  });
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="module">
      <div className="mb-6 flex items-center gap-2"><Layers className="text-brand-600" /><h1 className="text-2xl font-bold">Categories</h1></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.id} href={`/docs/category/${c.slug}`} className="tile group p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold group-hover:text-brand-600" style={{ color: c.color }}>{c.name}</h2>
              <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{c._count.articles}</span>
            </div>
            {c.description && <p className="mt-2 text-sm text-[var(--muted)]">{c.description}</p>}
          </Link>
        ))}
      </div>
      {categories.length === 0 && <p className="text-[var(--muted)]">No categories yet.</p>}
      </div>
    </div>
  );
}
