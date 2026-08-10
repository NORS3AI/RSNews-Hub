import { prisma } from './db';
import { RECOMMENDABLE_STATUSES } from './constants';

export type ArticleCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  coverFocus?: string | null;
  publishedAt: Date | null;
  views: number;
  readMinutes: number;
  category: { name: string; slug: string; color: string } | null;
  extraCategories: { name: string; slug: string; color: string }[];
  breakingUntil: Date | null;
  tags: { name: string; slug: string }[];
  requirement?: string;
};

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  coverFocus: true,
  publishedAt: true,
  views: true,
  readMinutes: true,
  requirement: true,
  breakingUntil: true,
  category: { select: { name: true, slug: true, color: true } },
  extraCategories: { select: { name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;

function toCard(a: any): ArticleCard {
  return { ...a, tags: (a.tags ?? []).map((t: any) => t.tag) };
}

/**
 * Content-based recommendation. Given an article, score every other published
 * article by how many tags it shares plus a bonus for the same category, then
 * fall back to recency/popularity. This is the "if you read this, this might
 * interest you" engine.
 */
export async function getRelatedArticles(articleId: string, limit = 4): Promise<ArticleCard[]> {
  const src = await prisma.article.findUnique({
    where: { id: articleId },
    select: { categoryId: true, tags: { select: { tagId: true } } },
  });

  const tagIds = src?.tags.map((t) => t.tagId) ?? [];

  const candidates = await prisma.article.findMany({
    where: {
      status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() },
      id: { not: articleId },
      OR: [
        tagIds.length ? { tags: { some: { tagId: { in: tagIds } } } } : {},
        src?.categoryId ? { categoryId: src.categoryId } : {},
      ].filter((o) => Object.keys(o).length),
    },
    select: { ...cardSelect, categoryId: true, tags: { select: { tag: { select: { name: true, slug: true } }, tagId: true } } },
    take: 40,
  });

  const scored = candidates
    .map((a) => {
      let score = 0;
      const shared = a.tags.filter((t: any) => tagIds.includes(t.tagId)).length;
      score += shared * 3;
      if (src?.categoryId && a.categoryId === src.categoryId) score += 2;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score || (y.a.views ?? 0) - (x.a.views ?? 0));

  let picks = scored.slice(0, limit).map((s) => toCard(s.a));

  // Backfill with most recent published articles if not enough related found.
  if (picks.length < limit) {
    const have = new Set([articleId, ...picks.map((p) => p.id)]);
    const filler = await prisma.article.findMany({
      where: { status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() }, id: { notIn: [...have] } },
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
      select: cardSelect,
      take: limit - picks.length,
    });
    picks = [...picks, ...filler.map(toCard)];
  }
  return picks;
}

/**
 * Personalized feed based on a reader's history. Aggregates tags/categories the
 * reader has engaged with and surfaces fresh articles matching those interests.
 */
export async function getPersonalizedFeed(
  opts: { userId?: string | null; sessionId?: string | null; limit?: number }
): Promise<ArticleCard[]> {
  const limit = opts.limit ?? 6;
  const where = opts.userId
    ? { userId: opts.userId }
    : opts.sessionId
    ? { sessionId: opts.sessionId }
    : null;

  if (!where) return trendingArticles(limit);

  const history = await prisma.readingLog.findMany({
    where,
    orderBy: { readAt: 'desc' },
    take: 30,
    select: { articleId: true, article: { select: { categoryId: true, tags: { select: { tagId: true } } } } },
  });

  if (!history.length) return trendingArticles(limit);

  const readIds = new Set(history.map((h) => h.articleId));
  const tagWeight = new Map<string, number>();
  const catWeight = new Map<string, number>();
  for (const h of history) {
    if (h.article?.categoryId) catWeight.set(h.article.categoryId, (catWeight.get(h.article.categoryId) ?? 0) + 1);
    for (const t of h.article?.tags ?? []) tagWeight.set(t.tagId, (tagWeight.get(t.tagId) ?? 0) + 1);
  }

  const topTags = [...tagWeight.keys()];
  const topCats = [...catWeight.keys()];

  const candidates = await prisma.article.findMany({
    where: {
      status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() },
      id: { notIn: [...readIds] },
      OR: [
        topTags.length ? { tags: { some: { tagId: { in: topTags } } } } : {},
        topCats.length ? { categoryId: { in: topCats } } : {},
      ].filter((o) => Object.keys(o).length),
    },
    select: { ...cardSelect, categoryId: true, tags: { select: { tag: { select: { name: true, slug: true } }, tagId: true } } },
    take: 50,
  });

  const scored = candidates
    .map((a) => {
      let score = 0;
      for (const t of a.tags as any[]) score += tagWeight.get(t.tagId) ?? 0;
      if (a.categoryId) score += (catWeight.get(a.categoryId) ?? 0) * 0.5;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score);

  let picks = scored.slice(0, limit).map((s) => toCard(s.a));
  if (picks.length < limit) {
    const have = new Set([...readIds, ...picks.map((p) => p.id)]);
    const filler = await trendingArticles(limit - picks.length, [...have]);
    picks = [...picks, ...filler];
  }
  return picks;
}

export async function trendingArticles(limit = 6, excludeIds: string[] = []): Promise<ArticleCard[]> {
  const rows = await prisma.article.findMany({
    where: { status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() }, id: excludeIds.length ? { notIn: excludeIds } : undefined },
    orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
    select: cardSelect,
    take: limit,
  });
  return rows.map(toCard);
}

/**
 * "Trending right now" — the most-opened articles over a rolling recent window
 * (default 7 days), so the list reflects what readers are actually reading this
 * week rather than all-time view totals. Popularity is measured from
 * `article_open` analytics events. When the window is thin (a quiet stretch or a
 * brand-new site) it backfills with all-time trending so the slot never looks
 * empty. Returns cards in descending recent-popularity order.
 */
export async function trendingWindowArticles(limit = 5, days = 7, excludeIds: string[] = []): Promise<ArticleCard[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const exclude = new Set(excludeIds);

  // Count recent opens per article; pull a buffer so status/exclusion filtering
  // below still leaves enough candidates.
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['subjectId'],
    where: { type: 'article_open', subjectType: 'article', subjectId: { not: null }, createdAt: { gte: since } },
    _count: { subjectId: true },
    orderBy: { _count: { subjectId: 'desc' } },
    take: limit * 5,
  });

  const rankedIds = grouped
    .map((g) => g.subjectId as string)
    .filter((id) => id && !exclude.has(id));

  let picks: ArticleCard[] = [];
  if (rankedIds.length) {
    // Only surface articles still eligible for the homepage; keep the popularity
    // ordering from the grouping (findMany doesn't preserve `in` order).
    const rows = await prisma.article.findMany({
      where: { id: { in: rankedIds }, status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() } },
      select: cardSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    picks = rankedIds.map((id) => byId.get(id)).filter(Boolean).map(toCard).slice(0, limit);
  }

  // Backfill from all-time trending when the recent window is thin.
  if (picks.length < limit) {
    const have = new Set([...exclude, ...picks.map((p) => p.id)]);
    const filler = await trendingArticles(limit - picks.length, [...have]);
    picks = [...picks, ...filler];
  }
  return picks;
}

// Small deterministic RNG (mulberry32) so a given day seed always yields the
// same shuffle — the Rediscover module rotates once per day, not per request.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * "Rediscover" — resurfaces older stories from the back catalog, rotating to a
 * different set each day. The freshest handful are skipped (they live in Latest /
 * This week), then the remaining pool is shuffled with a day-derived seed and the
 * top `limit` returned. Deterministic within a UTC day, different the next day.
 * Returns [] until there is enough back catalog to draw from, so the module
 * simply hides on a young site.
 */
export async function rediscoverArticles(limit = 5, excludeIds: string[] = [], skipFreshest = 6): Promise<ArticleCard[]> {
  const exclude = new Set(excludeIds);
  // Candidate pool: everything eligible, newest first, minus the freshest few.
  const rows = await prisma.article.findMany({
    where: { status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() }, id: exclude.size ? { notIn: [...exclude] } : undefined },
    orderBy: { publishedAt: 'desc' },
    select: cardSelect,
    skip: skipFreshest,
    take: 60,
  });
  if (!rows.length) return [];
  const daySeed = Math.floor(Date.now() / (24 * 3600 * 1000));
  return seededShuffle(rows, daySeed).slice(0, limit).map(toCard);
}

/**
 * Smart search: ranks by weighted relevance across title, excerpt, content,
 * category and tags. SQLite-friendly (uses `contains`), tokenizes the query so
 * multi-word searches match partial term overlap.
 */
export async function smartSearch(query: string, limit = 20): Promise<ArticleCard[]> {
  const q = query.trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 8);

  const rows = await prisma.article.findMany({
    where: {
      status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() },
      OR: terms.flatMap((t) => [
        { title: { contains: t } },
        { excerpt: { contains: t } },
        { content: { contains: t } },
        { category: { name: { contains: t } } },
        { tags: { some: { tag: { name: { contains: t } } } } },
      ]),
    },
    select: { ...cardSelect, content: true },
    take: 80,
  });

  const scored = rows
    .map((a) => {
      let score = 0;
      const title = a.title.toLowerCase();
      const excerpt = (a.excerpt ?? '').toLowerCase();
      const content = (a.content ?? '').toLowerCase();
      const tagNames = (a.tags as any[]).map((t) => t.tag.name.toLowerCase());
      for (const term of terms) {
        const t = term.toLowerCase();
        if (title.includes(t)) score += 10;
        if (title.startsWith(t)) score += 5;
        if (excerpt.includes(t)) score += 4;
        if (tagNames.some((n) => n.includes(t))) score += 4;
        if (a.category?.name.toLowerCase().includes(t)) score += 3;
        if (content.includes(t)) score += 1;
      }
      score += Math.min(3, Math.log10((a.views ?? 0) + 1));
      return { a, score };
    })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);

  return scored.map((s) => {
    const { content, ...rest } = s.a as any;
    return toCard(rest);
  });
}
