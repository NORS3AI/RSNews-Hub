import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArticleCard from '@/components/ArticleCard';
import SubscribeButton from '@/components/SubscribeButton';
import {
  getArticleBySlug,
  getNextArticle,
  getPreviousArticle,
  getRelatedArticles,
  incrementViews,
  recordRead,
} from '@/lib/articles';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { isSubscribedToArticle } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: 'Article not found' };
  return {
    title: article.title,
    description: article.excerpt,
  };
}

function renderBody(body: string) {
  return body
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para, i) => (
      <p key={i}>
        {para.split('\n').map((line, j) => (
          <span key={j}>
            {line}
            {j < para.split('\n').length - 1 && <br />}
          </span>
        ))}
      </p>
    ));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  const user = await getCurrentUser();

  if (!article) notFound();
  // Only published articles are public; staff may preview any status.
  if (article.status !== 'published' && !isStaff(user)) notFound();

  // Side effects: count the view and record reading history for signed-in users.
  incrementViews(article.id);
  if (user) recordRead(user.id, article.id);

  const next = getNextArticle(article);
  const prev = getPreviousArticle(article);
  const related = getRelatedArticles(article, 3);
  const subscribed = user ? isSubscribedToArticle(user.id, article.id) : false;

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="container-rs py-8">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/main" className="hover:text-slate-900">
          Home
        </Link>
        {article.category_name && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/categories/${article.category_slug}`} className="hover:text-slate-900">
              {article.category_name}
            </Link>
          </>
        )}
      </nav>

      <article className="mx-auto max-w-3xl">
        {article.status !== 'published' && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Preview — this article is <strong>{article.status}</strong> and not visible to the public.
          </div>
        )}

        <header className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {article.category_name && (
              <span className="badge bg-brand-50 text-brand-700">{article.category_name}</span>
            )}
            {publishedDate && <span>{publishedDate}</span>}
            <span>·</span>
            <span>{article.views} views</span>
          </div>
          <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            {article.title}
          </h1>
          {article.excerpt && <p className="mt-4 text-lg text-slate-600">{article.excerpt}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-4">
            <div className="text-sm text-slate-500">
              By <span className="font-medium text-slate-700">{article.author_name || 'RSNews'}</span>
            </div>
            <SubscribeButton
              articleId={article.id}
              initialSubscribed={subscribed}
              isLoggedIn={!!user}
            />
          </div>
        </header>

        {article.cover_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.cover_image}
            alt=""
            className="mb-8 aspect-[16/9] w-full rounded-xl object-cover"
          />
        )}

        <div className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-brand-700">
          {renderBody(article.body)}
        </div>

        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {article.tags.map((t) => (
              <Link key={t.id} href={`/search?tag=${t.slug}`} className="chip">
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </article>

      {/* Prev / Next navigation */}
      <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/articles/${prev.slug}`}
            className="card group flex flex-col p-5 transition-shadow hover:shadow-md"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              ← Previous
            </span>
            <span className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700">
              {prev.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {next && (
          <Link
            href={`/articles/${next.slug}`}
            className="card group flex flex-col p-5 text-right transition-shadow hover:shadow-md"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Read next →
            </span>
            <span className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700">
              {next.title}
            </span>
          </Link>
        )}
      </div>

      {/* Related / recommendations */}
      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-5xl">
          <h2 className="mb-1 text-xl font-bold text-slate-900">If you read this, you might like</h2>
          <p className="mb-6 text-sm text-slate-500">Suggested from shared topics and category.</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
