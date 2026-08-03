import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { publishedArticles } from '@/lib/queries';
import ArticleCard from '@/components/ArticleCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const t = await prisma.tag.findUnique({ where: { slug: params.slug } });
  return { title: t ? `#${t.name}` : 'Tag' };
}

export default async function TagPage({ params }: { params: { slug: string } }) {
  const tag = await prisma.tag.findUnique({ where: { slug: params.slug } });
  if (!tag) notFound();
  const articles = await publishedArticles({ tags: { some: { tagId: tag.id } } });
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
