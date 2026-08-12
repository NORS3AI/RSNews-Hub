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
import ListenButton from '@/components/site/ListenButton';
import CoverVideo from '@/components/site/CoverVideo';
import AdWithOptions from '@/components/site/AdWithOptions';
import ArticleContent from '@/components/site/ArticleContent';
import { pickArticleAds, loadBrandArticleAds } from '@/lib/adsServer';
import { getSupplierAdMap, savedVendorIds } from '@/lib/suppliers';
import { resolveArticleEmbeds } from '@/lib/articleEmbeds';
import { entitlementsOf, canViewContent, requirementLabel } from '@/lib/entitlements';
import { activeViewAs } from '@/lib/viewAsServer';
import { applyViewAs } from '@/lib/viewAs';
import { isBreaking } from '@/components/ArticleBadges';
import { genreLabel, genreBadgeClass } from '@/lib/genre';
import { Clock, Eye, ArrowRight, ArrowLeft, Tag as TagIcon, Lock } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function getArticle(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      category: true,
      extraCategories: { select: { name: true, slug: true, color: true } },
      author: { select: { name: true, bio: true } },
      tags: { select: { tag: true } },
    },
  });
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const a = await prisma.article.findUnique({ where: { slug: params.slug }, select: { title: true, excerpt: true, coverImage: true, publishedAt: true } });
  if (!a) return { title: 'Not found' };
  const description = a.excerpt ?? undefined;
  const images = a.coverImage ? [a.coverImage] : undefined;
  return {
    title: a.title,
    description,
    alternates: { canonical: `/docs/article/${params.slug}` },
    openGraph: { title: a.title, description, type: 'article', images, publishedTime: a.publishedAt?.toISOString() },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: a.title, description, images },
  };
}

export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await getArticle(params.slug);
  if (!article || (article.status !== 'PUBLISHED' && article.status !== 'ARCHIVED')) notFound();
  // Scheduled (future-dated) articles are not yet public.
  if (article.status === 'PUBLISHED' && article.publishedAt && article.publishedAt > new Date()) notFound();

  const user = await getCurrentUser();
  // Admin "View as": preview the gate through the impersonated audience so an
  // admin can confirm what a basic member (vs. premium/PackageHub) actually sees.
  const viewingAs = await activeViewAs(user);
  const gateAccount = viewingAs ? applyViewAs(user, viewingAs) : user;

  // Access gate (e.g. PackageHub–only content). Enforced here, server-side,
  // before any content is read or a view is tracked.
  if (!canViewContent(gateAccount, article.requirement)) {
    return <LockedArticle article={article} />;
  }

  const [related, next] = await Promise.all([
    getRelatedArticles(article.id, 3),
    prisma.article.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { lt: article.publishedAt ?? new Date() }, id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true, excerpt: true },
    }),
  ]);

  const adTagText = article.tags.map(({ tag }) => tag.name).join(' ');
  const adContext = `${article.title} ${article.content} ${adTagText}`;
  // Competitor suppression matches the article's TAGS (+ title) — curated business
  // names — not the full body, so a stray word can't hide an ad.
  const adSafeContext = `${article.title} ${adTagText}`;
  // A visiting vendor sees their own brand's ads surfaced first (and an admin
  // viewing "as" a vendor sees the same).
  const favorBrand = entitlementsOf(gateAccount ?? {}).vendorBrand;
  const [ads, embeds, slotAds, supplierAdMap, savedSupplierIds] = await Promise.all([
    pickArticleAds(adContext, 'article', favorBrand, adSafeContext),
    resolveArticleEmbeds(article.content, user?.id),
    loadBrandArticleAds(article.content),
    getSupplierAdMap(),
    user ? savedVendorIds(user.id) : Promise.resolve([]),
  ]);
  const inlineAds = [ads.top, ads.bottom].filter(Boolean) as NonNullable<typeof ads.top>[];

  return (
    <>
      <ReadTracker articleId={article.id} title={article.title} slug={article.slug} />
      <div className="container-reader py-8 sm:py-12">
        <Link href="/docs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          <ArrowLeft width={16} height={16} /> All articles
        </Link>

        {/* Reading surface — a cream card so the body is readable on the textured
            page surround, matching the in-app reader modal. */}
        <div className="card p-6 sm:p-9 lg:p-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {isBreaking(article.breakingUntil) && <span className="badge animate-pulse bg-red-600 text-white">⚡ Breaking</span>}
          {genreLabel(article.genre) && <span className={`badge font-bold uppercase tracking-wide ${genreBadgeClass(article.genre)}`}>{genreLabel(article.genre)}</span>}
          {article.category && (
            <Link href={`/docs/category/${article.category.slug}`} className="badge cat-badge"
              style={{ '--c': article.category.color } as React.CSSProperties}>
              {article.category.name}
            </Link>
          )}
          {article.extraCategories.map((c) => (
            <Link key={c.slug} href={`/docs/category/${c.slug}`} className="badge cat-badge"
              style={{ '--c': c.color } as React.CSSProperties}>
              {c.name}
            </Link>
          ))}
          {article.status === 'ARCHIVED' && <span className="badge bg-amber-100 text-amber-700">Archived</span>}
        </div>

        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{article.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
          {(article.byline || article.author?.name) && <span>By {article.byline || article.author?.name}</span>}
          <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
          <span className="flex items-center gap-1"><Clock width={14} height={14} />{article.readMinutes} min read</span>
          <span className="flex items-center gap-1"><Eye width={14} height={14} />{article.views} views</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {article.audioStatus === 'READY' && article.audioUrl && <ListenButton src={article.audioUrl} />}
          <StarButton item={{ id: article.id, title: article.title, slug: article.slug }} variant="inline" />
          <ShareButton slug={article.slug} title={article.title} />
          {article.category && (
            <SubscribeButton topicSlug={article.category.slug} label={`Follow ${article.category.name}`} />
          )}
        </div>

        {article.coverVideo ? (
          <CoverVideo src={article.coverVideo} poster={article.coverImage} className="mt-8 aspect-[16/9] w-full rounded-xl object-cover" />
        ) : article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          (<img src={article.coverImage} alt="" className="mt-8 aspect-[16/9] w-full rounded-xl object-cover" />)
        ) : null}

        <div className="my-6"><AdWithOptions ad={ads.top} suppliers={supplierAdMap} savedIds={savedSupplierIds} signedIn={!!user} slot="article-top" size="in-article" /></div>

        <article className="prose-article mt-8" data-reader data-slug={article.slug} data-title={article.title} data-author={article.byline || article.author?.name || ''}>
          <ArticleContent html={article.content} ads={inlineAds} adBySlot={slotAds} pollData={embeds.polls} quizData={embeds.quizzes} loggedIn={!!user} />
        </article>

        <div className="my-8 flex justify-center"><AdWithOptions ad={ads.bottom} suppliers={supplierAdMap} savedIds={savedSupplierIds} signedIn={!!user} slot="article-bottom" size="rectangle" /></div>

        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-6">
            <TagIcon width={16} height={16} className="text-[var(--muted)]" />
            {article.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/docs/tag/${tag.slug}`}
                className="badge border border-[var(--border)] hover:bg-[var(--bg-soft)]">#{tag.name}</Link>
            ))}
          </div>
        )}
        </div>

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

// Access-gated article: the title/excerpt are shown as a teaser, but the content
// is withheld and no read is tracked. `requirement` labels who it's for.
function LockedArticle({ article }: { article: { title: string; excerpt: string | null; requirement: string; category: { name: string; slug: string; color: string } | null } }) {
  const who = requirementLabel(article.requirement);
  return (
    <div className="container-reader py-8 sm:py-12">
      <Link href="/docs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
        <ArrowLeft width={16} height={16} /> All articles
      </Link>
      {article.category && (
        <div className="mb-4">
          <span className="badge cat-badge" style={{ '--c': article.category.color } as React.CSSProperties}>{article.category.name}</span>
        </div>
      )}
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{article.title}</h1>
      {article.excerpt && <p className="mt-4 text-lg text-[var(--muted)]">{article.excerpt}</p>}

      {/* Locked notice: state the membership it's behind, and nothing more — no
          upsell, no redirect. */}
      <div className="card mt-8 flex flex-col items-center p-8 text-center">
        <Lock width={26} height={26} className="text-[var(--muted)]" />
        <p className="mt-3 text-base font-semibold">This article is locked</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Available to {who}{who.toLowerCase().endsWith('s') ? '' : ' members'}.</p>
      </div>
    </div>
  );
}
