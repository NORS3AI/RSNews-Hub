import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRelatedArticles } from '@/lib/recommend';

export const dynamic = 'force-dynamic';

// Serves a single article as JSON for the reader modal (no full navigation).
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      author: { select: { name: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  if (!article || (article.status !== 'PUBLISHED' && article.status !== 'ARCHIVED')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [related, next] = await Promise.all([
    getRelatedArticles(article.id, 3),
    prisma.article.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { lt: article.publishedAt ?? new Date() }, id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true },
    }),
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
      tags: article.tags.map((t) => t.tag),
    },
    related: related.map((r) => ({ id: r.id, title: r.title, slug: r.slug, category: r.category })),
    next,
  });
}
