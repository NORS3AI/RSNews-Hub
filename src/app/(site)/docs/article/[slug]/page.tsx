import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getArticlePageData, getArticleMeta } from '@/lib/articleData';
import RecommendButton from '@/components/site/RecommendButton';
import RecommendCount from '@/components/site/RecommendCount';
import { RecommendProvider } from '@/components/site/RecommendProvider';
import ReadTracker from '@/components/ReadTracker';
import SubscribeButton from '@/components/SubscribeButton';
import StarButton from '@/components/site/StarButton';
import ShareButton from '@/components/site/ShareButton';
import ListenButton from '@/components/site/ListenButton';
import CoverVideo from '@/components/site/CoverVideo';
import AdWithOptions from '@/components/site/AdWithOptions';
import ArticleContent from '@/components/site/ArticleContent';
import { requirementLabel } from '@/lib/entitlements';
import { isBreaking, PartnerContentBadge, isPartnerContent } from '@/components/ArticleBadges';
import { genreLabel, genreBadgeClass } from '@/lib/genre';
import PreviewReviewBar from '@/components/site/PreviewReviewBar';
import { Clock, Eye, ArrowRight, ArrowLeft, Tag as TagIcon, Lock } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const a = await getArticleMeta(params.slug);
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

export default async function ArticlePage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; dash?: string }> }) {
  const params = await props.params;
  const sp = await props.searchParams;
  // The Information layer owns the fetch + the access decision, returning one of
  // three outcomes. `&dash=1` means the vendor opened this from their dashboard —
  // they respond there, so the in-preview review button is hidden.
  const result = await getArticlePageData(params.slug, { previewParam: sp?.preview, previewFromDashboard: sp?.dash === '1' });
  if (result.kind === 'notFound') notFound();
  if (result.kind === 'locked') return <LockedArticle article={result.article} />;
  const {
    article, isPreview, previewFromDashboard, signedIn,
    related, next, recommend,
    ads, inlineAds, embeds, slotAds, reservedAdMap, supplierAdMap, savedSupplierIds, adAttribution,
  } = result;

  return (
    <>
      {isPreview
        ? <PreviewReviewBar slug={article.slug} token={article.previewToken!} hideReview={previewFromDashboard} />
        : <ReadTracker articleId={article.id} title={article.title} slug={article.slug} />}
      <div className="container-reader py-8 sm:py-12">
        <Link href="/docs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          <ArrowLeft width={16} height={16} /> All articles
        </Link>

        {/* Reading surface — a cream card so the body is readable on the textured
            page surround, matching the in-app reader modal. */}
        <div className="card p-6 sm:p-9 lg:p-10">
        <RecommendProvider articleId={article.id} initialCount={recommend.recommends} initialOn={recommend.recommended} signedIn={signedIn}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {isBreaking(article.breakingUntil) && <span className="badge animate-pulse bg-red-600 text-white">⚡ Breaking</span>}
          {/* FTC disclosure: any vendor-connected piece (a premium supplier's What's
              Hot article) or a 'sponsored' one shows one clear "Partner content" tag,
              which supersedes the plain 'sponsored' genre chip. */}
          {isPartnerContent(article) && <PartnerContentBadge />}
          {genreLabel(article.genre) && article.genre !== 'sponsored' && <span className={`badge font-bold uppercase tracking-wide ${genreBadgeClass(article.genre)}`}>{genreLabel(article.genre)}</span>}
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
          <RecommendCount />
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

        <div className="my-6"><AdWithOptions ad={ads.top} suppliers={supplierAdMap} savedIds={savedSupplierIds} signedIn={signedIn} slot="article-top" size="in-article" placeholder={false} adContext={adAttribution} /></div>

        <article className="prose-article mt-8" data-reader data-slug={article.slug} data-title={article.title} data-author={article.byline || article.author?.name || ''}>
          <ArticleContent html={article.content} ads={inlineAds} adBySlot={slotAds} adById={reservedAdMap} pollData={embeds.polls} quizData={embeds.quizzes} loggedIn={signedIn} adContext={adAttribution} />
        </article>

        <div className="my-8 flex justify-center"><AdWithOptions ad={ads.bottom} suppliers={supplierAdMap} savedIds={savedSupplierIds} signedIn={signedIn} slot="article-bottom" size="rectangle" placeholder={false} adContext={adAttribution} /></div>

        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-6">
            <TagIcon width={16} height={16} className="text-[var(--muted)]" />
            {article.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/docs/tag/${tag.slug}`}
                className="badge border border-[var(--border)] hover:bg-[var(--bg-soft)]">#{tag.name}</Link>
            ))}
          </div>
        )}

        {/* End-of-article endorsement — placed right before Read next / related.
            Only a PUBLISHED article can be recommended (the API gates on it), so
            the button is hidden on an archived piece (the count still shows). */}
        {article.status === 'PUBLISHED' && <RecommendButton />}

        {/* Read next + related — kept INSIDE the reading card at the bottom, compact,
            so the full page matches the in-app reader modal (not a separate,
            oversized full-width module). */}
        {(next || related.length > 0) && (
          <div className="mt-8 space-y-6 border-t border-[var(--border)] pt-6">
            {next && (
              <Link href={`/docs/article/${next.slug}`}
                className="card card-soft card-hover flex items-center justify-between gap-4 p-5">
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Read next</span>
                  <span className="mt-1 block truncate font-semibold">{next.title}</span>
                </span>
                <ArrowRight className="shrink-0 text-brand-600" />
              </Link>
            )}
            {related.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">If you read this, you might like…</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {related.slice(0, 3).map((r) => (
                    <Link key={r.id} href={`/docs/article/${r.slug}`} className="card card-soft card-hover p-4">
                      {r.category && <span className="cat-ink text-xs font-bold" style={{ '--c': r.category.color } as React.CSSProperties}>{r.category.name}</span>}
                      <span className="mt-1 block text-[17px] font-extrabold leading-tight tracking-tight">{r.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </RecommendProvider>
        </div>
      </div>
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
