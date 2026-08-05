import { prisma } from './db';
import type { ArticleCard } from './recommend';

export const listSelect = {
  id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true,
  views: true, readMinutes: true, requirement: true,
  category: { select: { name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;

export function toCard(a: any): ArticleCard {
  return { ...a, tags: (a.tags ?? []).map((t: any) => t.tag) };
}

// Shared visibility clause: PUBLISHED and not scheduled for the future.
export const liveWhere = () => ({ status: 'PUBLISHED', publishedAt: { lte: new Date() } });

export async function publishedArticles(where: any = {}, take = 24, skip = 0) {
  const rows = await prisma.article.findMany({
    where: { ...liveWhere(), ...where },
    orderBy: { publishedAt: 'desc' },
    select: listSelect, take, skip,
  });
  return rows.map(toCard);
}
