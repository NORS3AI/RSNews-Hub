import { prisma } from './db';
import { getCurrentUser } from './auth';
import { getRelatedArticles } from './recommend';
import { getRecommendState } from './articleRecommend';
import { pickArticleAds, loadBrandArticleAds, resolveReservedArticleAds, resolveArticleLockBrand } from './adsServer';
import { getSupplierAdMap, savedVendorIds } from './suppliers';
import { resolveArticleEmbeds } from './articleEmbeds';
import { entitlementsOf, canViewContent } from './entitlements';
import { activeViewAs } from './viewAsServer';
import { applyViewAs } from './viewAs';

// Information layer for the article reader page. It owns all the fetching AND the
// access-control decision, but stays framework-agnostic: instead of calling
// Next's notFound()/rendering a component, it returns a discriminated result and
// lets the page act on it —
//   { kind: 'notFound' }            → page calls notFound()
//   { kind: 'locked', article }     → page renders the locked teaser
//   { kind: 'full', ...bundle }     → page renders the full reader
// So the gate is decided once, here, and any renderer (React today, anything
// later) consumes the same three outcomes.

function getArticle(slug: string) {
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

// Lightweight lookup for generateMetadata — keeps Prisma out of the page module.
export async function getArticleMeta(slug: string) {
  return prisma.article.findUnique({ where: { slug }, select: { title: true, excerpt: true, coverImage: true, publishedAt: true } });
}

export async function getArticlePageData(slug: string, opts: { previewParam?: string; previewFromDashboard: boolean }) {
  const article = await getArticle(slug);
  if (!article) return { kind: 'notFound' as const };

  // Private preview: a valid ?preview=<token> unlocks the full reader view of an
  // UNPUBLISHED article (and bypasses the paywall + tracking) so an invited
  // reviewer can approve it — but ONLY while the article isn't yet publicly live,
  // otherwise the non-rotating token would be a permanent, shareable paywall
  // bypass on a published gated article.
  const nowTs = new Date();
  const isLivePublic =
    article.status === 'ARCHIVED' ||
    (article.status === 'PUBLISHED' && (!article.publishedAt || article.publishedAt <= nowTs));
  const isPreview = !!opts.previewParam && !!article.previewToken && opts.previewParam === article.previewToken && !isLivePublic;

  if (!isPreview) {
    if (article.status !== 'PUBLISHED' && article.status !== 'ARCHIVED') return { kind: 'notFound' as const };
    // Scheduled (future-dated) articles are not yet public.
    if (article.status === 'PUBLISHED' && article.publishedAt && article.publishedAt > new Date()) return { kind: 'notFound' as const };
  }

  const user = await getCurrentUser();
  // Admin "View as": preview the gate through the impersonated audience so an
  // admin can confirm what a basic member (vs. premium/PackageHub) actually sees.
  const viewingAs = await activeViewAs(user);
  const gateAccount = viewingAs ? applyViewAs(user, viewingAs) : user;

  // Access gate, enforced here — before any content is read or a view tracked. A
  // valid preview link bypasses it (the invited reviewer sees the full piece).
  if (!isPreview && !canViewContent(gateAccount, article.requirement)) {
    return { kind: 'locked' as const, article };
  }

  const [related, next, recommend] = await Promise.all([
    getRelatedArticles(article.id, 3),
    prisma.article.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { lt: article.publishedAt ?? new Date() }, id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true, excerpt: true },
    }),
    getRecommendState(article.id, user ? { userId: user.id } : null, article.recommends),
  ]);

  const adTagText = article.tags.map(({ tag }) => tag.name).join(' ');
  const adContext = `${article.title} ${article.content} ${adTagText}`;
  // Competitor suppression matches the article's TAGS (+ title) — curated business
  // names — not the full body, so a stray word can't hide an ad.
  const adSafeContext = `${article.title} ${adTagText}`;
  // A visiting vendor sees their own brand's ads surfaced first (and an admin
  // viewing "as" a vendor sees the same).
  const favorBrand = entitlementsOf(gateAccount ?? {}).vendorBrand;
  // If this article is CONNECTED to a vendor, hard-lock every in-article ad to
  // that vendor — house ads fill any slot they can't, and a competitor can never
  // appear in their piece. resolveArticleLockBrand keeps the lock ON even if the
  // vendor was later removed (dangling id → house-only, never a rival).
  const lockBrand = await resolveArticleLockBrand(article.sponsorVendorId);
  const [ads, embeds, slotAds, reservedAdMap, supplierAdMap, savedSupplierIds] = await Promise.all([
    pickArticleAds(adContext, 'article', favorBrand, adSafeContext, lockBrand),
    resolveArticleEmbeds(article.content, user?.id),
    loadBrandArticleAds(article.content, lockBrand),
    resolveReservedArticleAds(article.content, lockBrand),
    getSupplierAdMap(),
    user ? savedVendorIds(user.id) : Promise.resolve([]),
  ]);
  const inlineAds = [ads.top, ads.bottom].filter(Boolean) as NonNullable<typeof ads.top>[];
  // Attribution carried into every in-article ad event: which article, and whether
  // it's a vendor-connected sponsored piece.
  const adAttribution = { articleId: article.id, articleSlug: article.slug, sponsored: !!article.sponsorVendorId };

  return {
    kind: 'full' as const,
    article,
    isPreview,
    previewFromDashboard: opts.previewFromDashboard,
    signedIn: !!user,
    related, next, recommend,
    ads, inlineAds, embeds, slotAds, reservedAdMap, supplierAdMap, savedSupplierIds, adAttribution,
  };
}

export type ArticlePageFull = Extract<Awaited<ReturnType<typeof getArticlePageData>>, { kind: 'full' }>;
