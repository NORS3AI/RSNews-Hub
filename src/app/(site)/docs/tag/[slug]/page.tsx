import { notFound } from 'next/navigation';
import { getTagData, getTagMeta } from '@/lib/tagData';
import ArticleCard from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const t = await getTagMeta(params.slug);
  return { title: t ? `#${t.name}` : 'Tag' };
}

export default async function TagPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const data = await getTagData(params.slug);
  if (!data) notFound();
  const { tag, articles } = data;
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold">#{tag.name}</h1>
      {articles.length === 0 ? (
        <p className="text-[var(--muted)]">No articles tagged “{tag.name}”.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}
    </div>
  );
}
