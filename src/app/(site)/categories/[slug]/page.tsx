import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArticleCard from '@/components/ArticleCard';
import { getCategoryBySlug, listArticles } from '@/lib/articles';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  return { title: category ? category.name : 'Category' };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const articles = listArticles({ status: 'published', categorySlug: slug, limit: 60 });

  return (
    <div className="container-rs py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Category</p>
      <h1 className="mt-1 text-3xl font-black text-slate-900">{category.name}</h1>
      {category.description && <p className="mt-2 text-slate-500">{category.description}</p>}

      {articles.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-slate-500">
          No published articles in this category yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
