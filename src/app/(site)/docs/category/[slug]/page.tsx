import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { publishedArticles } from '@/lib/queries';
import ArticleCard from '@/components/ArticleCard';
import SubscribeButton from '@/components/SubscribeButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const c = await prisma.category.findUnique({ where: { slug: params.slug } });
  return { title: c ? c.name : 'Category' };
}

export default async function CategoryPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const category = await prisma.category.findUnique({ where: { slug: params.slug } });
  if (!category) notFound();
  const [articles, user] = await Promise.all([publishedArticles({ categoryId: category.id }), getCurrentUser()]);
  const subscribed = user
    ? await prisma.subscription.findFirst({ where: { userId: user.id, categoryId: category.id } }).then(Boolean)
    : false;

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="cat-ink text-2xl font-bold" style={{ '--c': category.color } as React.CSSProperties}>{category.name}</h1>
          {category.description && <p className="mt-2 max-w-xl text-[var(--muted)]">{category.description}</p>}
        </div>
        <SubscribeButton categoryId={category.id} initialSubscribed={subscribed} isAuthed={!!user} label="Subscribe" size="md" />
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
