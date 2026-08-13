import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canViewContent } from '@/lib/entitlements';
import { activeViewAs } from '@/lib/viewAsServer';
import { applyViewAs } from '@/lib/viewAs';
import { getRelatedArticles } from '@/lib/recommend';
import { pickArticleAds, loadBrandArticleAds, resolveReservedArticleAds } from '@/lib/adsServer';
import { brandKey } from '@/lib/entitlements';
import { resolveArticleEmbeds } from '@/lib/articleEmbeds';

export const dynamic = 'force-dynamic';

// Serves a single article as JSON for the reader modal (no full navigation).
export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      extraCategories: { select: { name: true, slug: true, color: true } },
      author: { select: { name: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  if (!article || (article.status !== 'PUBLISHED' && article.status !== 'ARCHIVED')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Scheduled (future-dated) articles are not yet public.
  if (article.status === 'PUBLISHED' && article.publishedAt && article.publishedAt > new Date()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Access gate — same rule as the page. Never return a gated body here; the
  // modal falls back to the full page (which renders the locked teaser) on 403.
  const user = await getCurrentUser();
  // Honor admin "View as" so the modal locks/unlocks the same way the page does.
  const viewingAs = await activeViewAs(user);
  const gateAccount = viewingAs ? applyViewAs(user, viewingAs) : user;
  if (!canViewContent(gateAccount, article.requirement)) {
    return NextResponse.json({ error: 'Locked', requirement: article.requirement }, { status: 403 });
  }

  const adTagText = article.tags.map((t) => t.tag.name).join(' ');
  const adContext = `${article.title} ${article.content} ${adTagText}`;
  // Competitor suppression keys off the article's tags (+ title) — curated
  // business names — not the whole body (avoids stray-word false positives).
  const adSafeContext = `${article.title} ${adTagText}`;
  // If this article is CONNECTED to a vendor, hard-lock every in-article ad to
  // that vendor — MUST mirror the full page, or the modal (the primary reading
  // surface for logged-in readers) leaks a competitor's ad into their piece.
  const lockBrand = article.sponsorVendorId
    ? brandKey((await prisma.vendor.findUnique({ where: { id: article.sponsorVendorId }, select: { name: true } }))?.name || '')
    : '';
  const [related, next, ads, embeds, slotAds, reservedAdMap] = await Promise.all([
    getRelatedArticles(article.id, 3),
    prisma.article.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { lt: article.publishedAt ?? new Date() }, id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true },
    }),
    pickArticleAds(adContext, 'modal', '', adSafeContext, lockBrand),
    resolveArticleEmbeds(article.content, user?.id),
    loadBrandArticleAds(article.content, lockBrand),
    resolveReservedArticleAds(article.content, lockBrand),
  ]);

  return NextResponse.json({
    article: {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      coverImage: article.coverImage,
      coverVideo: article.coverVideo,
      status: article.status,
      readMinutes: article.readMinutes,
      views: article.views,
      publishedAt: article.publishedAt,
      byline: article.byline,
      author: article.author,
      category: article.category,
      extraCategories: article.extraCategories,
      breakingUntil: article.breakingUntil,
      genre: article.genre,
      tags: article.tags.map((t) => t.tag),
      audioUrl: article.audioStatus === 'READY' ? article.audioUrl : null,
    },
    related: related.map((r) => ({ id: r.id, title: r.title, slug: r.slug, category: r.category })),
    next,
    ads,
    embeds,
    slotAds,
    reservedAds: reservedAdMap,
    loggedIn: !!user,
  });
}
