import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canViewContent } from '@/lib/entitlements';
import { getRelatedArticles } from '@/lib/recommend';
import { pickArticleAds, loadBrandArticleAds } from '@/lib/adsServer';
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
  if (!canViewContent(user, article.requirement)) {
    return NextResponse.json({ error: 'Locked', requirement: article.requirement }, { status: 403 });
  }

  const adTagText = article.tags.map((t) => t.tag.name).join(' ');
  const adContext = `${article.title} ${article.content} ${adTagText}`;
  // Competitor suppression keys off the article's tags (+ title) — curated
  // business names — not the whole body (avoids stray-word false positives).
  const adSafeContext = `${article.title} ${adTagText}`;
  const [related, next, ads, embeds, slotAds] = await Promise.all([
    getRelatedArticles(article.id, 3),
    prisma.article.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { lt: article.publishedAt ?? new Date() }, id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true },
    }),
    pickArticleAds(adContext, 'modal', '', adSafeContext),
    resolveArticleEmbeds(article.content, user?.id),
    loadBrandArticleAds(article.content),
  ]);

  return NextResponse.json({
    article: {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      coverImage: article.coverImage,
      status: article.status,
      readMinutes: article.readMinutes,
      views: article.views,
      publishedAt: article.publishedAt,
      author: article.author,
      category: article.category,
      extraCategories: article.extraCategories,
      breakingUntil: article.breakingUntil,
      tags: article.tags.map((t) => t.tag),
      audioUrl: article.audioStatus === 'READY' ? article.audioUrl : null,
    },
    related: related.map((r) => ({ id: r.id, title: r.title, slug: r.slug, category: r.category })),
    next,
    ads,
    embeds,
    slotAds,
    loggedIn: !!user,
  });
}
