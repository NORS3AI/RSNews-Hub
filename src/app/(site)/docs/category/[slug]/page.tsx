import { notFound } from 'next/navigation';
import { getCategoryData, getCategoryMeta } from '@/lib/categoryData';
import ArticleCard from '@/components/ArticleCard';
import SubscribeButton from '@/components/SubscribeButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const c = await getCategoryMeta(params.slug);
  return { title: c ? c.name : 'Category' };
}

export default async function CategoryPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const data = await getCategoryData(params.slug);
  if (!data) notFound();
  const { category, articles } = data;

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="cat-ink text-2xl font-bold" style={{ '--c': category.color } as React.CSSProperties}>{category.name}</h1>
          {category.description && <p className="mt-2 max-w-xl text-[var(--muted)]">{category.description}</p>}
        </div>
        <SubscribeButton topicSlug={category.slug} label="Subscribe" size="md" />
      </div>
      {articles.length === 0 ? (
        <p className="text-[var(--muted)]">No articles in this category yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}
    </div>
  );
}
