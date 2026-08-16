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

// Industry-News archive: every active curated link, optionally filtered by a
// free-text query (headline / source / poster), grouped by month for the view.
export async function getIndustryArchiveData(rawQuery?: string) {
  const q = (rawQuery || '').trim();
  const links = await prisma.industryLink.findMany({
    where: {
      active: true,
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { source: { contains: q, mode: 'insensitive' as const } }, { author: { contains: q, mode: 'insensitive' as const } }] } : {}),
    },
    orderBy: [{ postedAt: 'desc' }],
  });
  const groups = new Map<string, typeof links>();
  for (const l of links) {
    const key = new Date(l.postedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  return { q, links, groups };
}

// Comics archive — every comic, newest first.
export async function getComicsArchiveData() {
  return prisma.comic.findMany({ orderBy: [{ postedAt: 'desc' }] });
}

// Pop-Quiz archive — every quiz with its question count + submission total.
// Answers are never selected (this is a public archive).
export async function getQuizzesArchiveData() {
  return prisma.quiz.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, active: true, closesAt: true, submissions: true, _count: { select: { questions: true } } },
  });
}

// Polls archive — every poll with its options + vote tallies.
export async function getPollsArchiveData() {
  return prisma.poll.findMany({
    orderBy: { createdAt: 'desc' },
    include: { options: { orderBy: { order: 'asc' } } },
  });
}

export type IndustryArchiveData = Awaited<ReturnType<typeof getIndustryArchiveData>>;
export type ComicsArchiveData = Awaited<ReturnType<typeof getComicsArchiveData>>;
export type QuizzesArchiveData = Awaited<ReturnType<typeof getQuizzesArchiveData>>;
export type PollsArchiveData = Awaited<ReturnType<typeof getPollsArchiveData>>;
