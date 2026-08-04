import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getRelatedArticles } from '@/lib/recommend';
import ArticleCard from '@/components/ArticleCard';
import ReadTracker from '@/components/ReadTracker';
import SubscribeButton from '@/components/SubscribeButton';
import StarButton from '@/components/site/StarButton';
import ShareButton from '@/components/site/ShareButton';
import InArticleAd from '@/components/InArticleAd';
import { pickArticleAds } from '@/lib/adsServer';
import { Clock, Eye, ArrowRight, ArrowLeft, Tag as TagIcon } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function getArticle(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      category: true,
      author: { select: { name: true, bio: true } },
      tags: { select: { tag: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await prisma.article.findUnique({ where: { slug: params.slug }, select: { title: true, excerpt: true } });
  if (!a) return { title: 'Not found' };
  return { title: a.title, description: a.excerpt ?? undefined, openGraph: { title: a.title, description: a.excerpt ?? undefined } };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article || (article.status !== 'PUBLISHED' && article.status !== 'ARCHIVED')) notFound();
  // Scheduled (future-dated) articles are not yet public.
  if (article.status === 'PUBLISHED' && article.publishedAt && article.publishedAt > new Date()) notFound();

  const user = await getCurrentUser();

  const [related, next, subscribed] = await Promise.all([
    getRelatedArticles(article.id, 3),
    prisma.article.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { lt: article.publishedAt ?? new Date() }, id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true, excerpt: true },
    }),
    user && article.categoryId
      ? prisma.subscription.findFirst({ where: { userId: user.id, categoryId: article.categoryId } }).then(Boolean)
      : Promise.resolve(false),
  ]);

  const adContext = `${article.title} ${article.content} ${article.tags.map(({ tag }) => tag.name).join(' ')}`;
  const ads = await pickArticleAds(adContext, 'article');

  return (
    <>
      <ReadTracker articleId={article.id} title={article.title} slug={article.slug} />
      <div className="container-reader py-8 sm:py-12">
        <Link href="/docs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          <ArrowLeft width={16} height={16} /> All articles
        </Link>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {article.category && (
            <Link href={`/docs/category/${article.category.slug}`} className="badge"
              style={{ backgroundColor: article.category.color + '22', color: article.category.color }}>
              {article.category.name}
            </Link>
          )}
          {article.status === 'ARCHIVED' && <span className="badge bg-amber-100 text-amber-700">Archived</span>}
        </div>

        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{article.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
          {article.author && <span>By {article.author.name}</span>}
          <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
          <span className="flex items-center gap-1"><Clock width={14} height={14} />{article.readMinutes} min read</span>
          <span className="flex items-center gap-1"><Eye width={14} height={14} />{article.views} views</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <StarButton item={{ id: article.id, title: article.title, slug: article.slug }} variant="inline" />
          <ShareButton slug={article.slug} title={article.title} />
          {article.category && (
            <SubscribeButton categoryId={article.categoryId} initialSubscribed={subscribed} isAuthed={!!user}
              label={`Follow ${article.category.name}`} />
          )}
        </div>

        {article.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverImage} alt="" className="mt-8 aspect-[16/9] w-full rounded-xl object-cover" />
        )}

        <div className="my-6"><InArticleAd ad={ads.top} slot="article-top" size="in-article" /></div>

        <article className="prose-article mt-8" data-reader data-slug={article.slug} data-title={article.title} data-author={article.author?.name || ''} dangerouslySetInnerHTML={{ __html: article.content }} />

        <div className="my-8 flex justify-center"><InArticleAd ad={ads.bottom} slot="article-bottom" size="rectangle" /></div>

        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-6">
            <TagIcon width={16} height={16} className="text-[var(--muted)]" />
            {article.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/docs/tag/${tag.slug}`}
                className="badge border border-[var(--border)] hover:bg-[var(--bg-soft)]">#{tag.name}</Link>
            ))}
          </div>
        )}

        {/* Next article */}
        {next && (
          <Link href={`/docs/article/${next.slug}`}
            className="card mt-10 flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-md">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Read next</div>
              <div className="mt-1 truncate font-semibold">{next.title}</div>
            </div>
            <ArrowRight className="shrink-0 text-brand-600" />
          </Link>
        )}
      </div>

      {/* Related — the recommendation engine */}
      {related.length > 0 && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-soft)]">
          <div className="container-page py-10">
            <h2 className="mb-5 text-lg font-bold">If you read this, you might like…</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
