import Link from 'next/link';
import type { Metadata } from 'next';
import { listCategories, listArticles } from '@/lib/articles';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default function CategoriesPage() {
  const categories = listCategories();

  return (
    <div className="container-rs py-8">
      <h1 className="text-3xl font-black text-slate-900">Categories</h1>
      <p className="mt-1 text-slate-500">Browse articles by topic.</p>

      {categories.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-slate-500">No categories yet.</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const count = listArticles({ status: 'published', categorySlug: c.slug, limit: 500 }).length;
            return (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="card group p-6 transition-shadow hover:shadow-md"
              >
                <h2 className="text-lg font-bold text-slate-900 group-hover:text-brand-700">
                  {c.name}
                </h2>
                {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
                <p className="mt-4 text-xs font-medium text-slate-400">
                  {count} article{count === 1 ? '' : 's'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
