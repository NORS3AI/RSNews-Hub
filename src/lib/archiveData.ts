import { prisma } from './db';

// Information layer for the archive index. "Most recommended" filters to
// genuinely-endorsed pieces (recommends > 0) ranked by endorsement count;
// "Newest" is the chronological archive, grouped by month for the view. This is
// a compact title-index (not a card surface), so it keeps its own minimal select.
export async function getArchiveData(sortParam?: string) {
  const sort = sortParam === 'recommended' ? 'recommended' : 'newest';
  const base = { OR: [{ status: 'ARCHIVED' as const }, { status: 'PUBLISHED' as const, publishedAt: { lte: new Date() } }] };
  const articles = await prisma.article.findMany({
    where: sort === 'recommended' ? { ...base, recommends: { gt: 0 } } : base,
    orderBy: sort === 'recommended'
      ? [{ recommends: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }] // id = stable final tiebreaker (publishedAt is nullable)
      : [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, title: true, slug: true, publishedAt: true, createdAt: true, status: true, recommends: true, category: { select: { name: true, color: true } } },
    ...(sort === 'recommended' ? { take: 100 } : {}),
  });

  // Newest view groups by month; the recommended view is a single ranked list.
  const groups = new Map<string, typeof articles>();
  if (sort === 'newest') {
    for (const a of articles) {
      const d = a.publishedAt ?? a.createdAt;
      const key = new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
  }
  return { sort, articles, groups };
}

export type ArchivePageData = Awaited<ReturnType<typeof getArchiveData>>;
