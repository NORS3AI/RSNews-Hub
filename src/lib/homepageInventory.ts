import { prisma } from './db';
import { getHomeLayout, moduleSource } from './homepage';
import { isCustomModuleId, customIdOf, parseTree, type Block } from './studio';
import { getPersonalizedFeed, trendingArticles } from './recommend';

// Homepage content inventory — what articles / polls / quizzes actually appear on
// the public homepage, and how many times each is placed, so an admin can spot
// unintended duplicates. It MIRRORS the selection logic in
// app/(site)/docs/page.tsx (the primary content modules) — keep the two in sync.
//
// Scope: the prominent content modules where an unwanted repeat is meaningful —
// Headline, Feature showcase, Latest, Trending, Recommended, Published this week,
// Category spotlights, custom Studio modules, and the council column/poll. The
// bottom "discovery" strips (Editor's picks, Quick reads, More to explore) are
// intentionally re-surfacing the same pool, so they're excluded on purpose.

type Lite = { id: string; title: string; slug: string };
export type InventoryKind = 'article' | 'poll' | 'quiz';
export type InventoryEntry = { id: string; title: string; slug: string; kind: InventoryKind; count: number; places: string[] };
export type HomepageInventory = { entries: InventoryEntry[]; totalSlots: number; uniqueCount: number; dupeCount: number };

export async function getHomepageInventory(userId?: string): Promise<HomepageInventory> {
  const layout = await getHomeLayout();
  const enabled = new Set(layout.filter((m) => m.enabled).map((m) => m.id));
  const now = new Date();

  // Every placement, in render order.
  const occ: { id: string; title: string; slug: string; kind: InventoryKind; place: string }[] = [];
  const pushArt = (a: Lite | null | undefined, place: string) => { if (a) occ.push({ ...a, kind: 'article', place }); };
  const pushArts = (as: Lite[], place: string) => as.forEach((a) => pushArt(a, place));

  // ---- Article pools (mirror docs/page.tsx) ----
  const [featured, all] = await Promise.all([
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: now }, featured: true }, orderBy: { publishedAt: 'desc' }, take: 3, select: { id: true, title: true, slug: true, publishedAt: true, category: { select: { slug: true } } } }),
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: now } }, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }], take: 20, select: { id: true, title: true, slug: true, publishedAt: true, category: { select: { slug: true } } } }),
  ]);
  const lead = featured[0] ?? all[0] ?? null;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = all.filter((a) => a.publishedAt && new Date(a.publishedAt).getTime() >= weekAgo).slice(0, 8);
  const latest = all.filter((a) => a.id !== lead?.id);
  const trending = (await trendingArticles(5)).map((a) => ({ id: a.id, title: a.title, slug: a.slug }));
  const featurePool = (source?: string): Lite[] =>
    source === 'latest' ? latest : source === 'trending' ? trending : (featured.length ? featured : all.slice(0, 5));

  // ---- Fixed + layout sections ----
  pushArt(lead, 'Headline (hero)');
  pushArts(recent, 'Published this week');
  if (enabled.has('latest')) pushArts(latest.slice(0, 7), 'Latest articles');
  if (enabled.has('trending')) pushArts(trending, 'Trending');
  if (enabled.has('feature-carousel')) {
    const m = layout.find((x) => x.id === 'feature-carousel');
    pushArts(featurePool(m ? moduleSource(m) : 'featured').slice(0, 8), 'Feature showcase');
  }
  if (enabled.has('recommended')) {
    const feed = await getPersonalizedFeed({ userId, limit: 12 });
    pushArts(feed.map((a) => ({ id: a.id, title: a.title, slug: a.slug })), 'Recommended (personalized)');
  }

  // Category spotlights: top-3 categories by published count, first 10 from `all`.
  const cats = await prisma.category.findMany({ include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: now } } } } } } });
  const topCats = [...cats].sort((a, b) => b._count.articles - a._count.articles).slice(0, 3);
  for (const c of topCats) {
    const items = all.filter((a) => a.category?.slug === c.slug).slice(0, 10);
    if (items.length) pushArts(items, `In ${c.name}`);
  }

  // RS Council column: the ungated council pieces (the council poll/quiz are NOT
  // here — they render in the Industry module's aside; see below).
  if (enabled.has('council')) {
    const council = await prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: now }, category: { slug: 'rs-council-column' }, requirement: '' }, orderBy: { publishedAt: 'desc' }, take: 12, select: { id: true, title: true, slug: true } });
    pushArts(council, 'RS Council column');
  }

  // ---- Custom Studio modules (layout order), with the page's custom-only dedup ----
  // Track which poll/quiz ids custom modules pin, so the Industry aside below can
  // yield them (matches the page's pinnedPollIds / pinnedQuizIds de-dup).
  const pinnedPollIds = new Set<string>();
  const pinnedQuizIds = new Set<string>();
  const used = new Set<string>();
  const firstUnused = (pool: Lite[], n = 1): Lite[] => {
    const out: Lite[] = [];
    for (const c of pool) { if (out.length >= n) break; if (!used.has(c.id)) { used.add(c.id); out.push(c); } }
    return out;
  };
  const resolveArticleBlock = async (b: Block): Promise<Lite[]> => {
    if (b.type === 'mosaic') {
      const count = Math.min(Math.max(Number(b.settings.count) || 4, 3), 6);
      return firstUnused(featurePool(String(b.settings.source ?? 'latest')), count);
    }
    const mode = b.settings.mode ?? 'auto';
    if (mode === 'pick') {
      const id = String(b.settings.articleId ?? '');
      const a = id ? await prisma.article.findUnique({ where: { id }, select: { id: true, title: true, slug: true, status: true } }) : null;
      if (a && a.status === 'PUBLISHED') { used.add(a.id); return [{ id: a.id, title: a.title, slug: a.slug }]; }
      return [];
    }
    if (mode === 'tag') {
      const t = String(b.settings.tag ?? '').trim().toLowerCase();
      const rows = t ? await prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: now }, tags: { some: { tag: { OR: [{ slug: { contains: t } }, { name: { contains: t } }] } } } }, orderBy: { publishedAt: 'desc' }, take: 12, select: { id: true, title: true, slug: true } }) : [];
      return firstUnused(rows);
    }
    if (mode === 'year') {
      const y = Number(b.settings.year);
      const rows = y > 0 ? await prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } }, orderBy: { publishedAt: 'desc' }, take: 12, select: { id: true, title: true, slug: true } }) : [];
      return firstUnused(rows);
    }
    if (mode === 'category') {
      const slug = String(b.settings.categorySlug ?? '').trim().toLowerCase();
      const rows = slug ? await prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: now }, OR: [{ category: { slug } }, { extraCategories: { some: { slug } } }] }, orderBy: { publishedAt: 'desc' }, take: 12, select: { id: true, title: true, slug: true } }) : [];
      return firstUnused(rows);
    }
    return firstUnused(featurePool(String(b.settings.source ?? 'latest')));
  };

  for (const m of layout) {
    if (!m.enabled || !isCustomModuleId(m.id)) continue;
    const row = await prisma.customModule.findUnique({ where: { id: customIdOf(m.id)! }, select: { name: true, tree: true, published: true } });
    if (!row || !row.published) continue;
    for (const b of parseTree(row.tree).children) {
      if (b.type.startsWith('article') || b.type === 'spotlight' || b.type === 'split' || b.type === 'mosaic') {
        pushArts(await resolveArticleBlock(b), row.name);
      } else if (b.type === 'poll' && b.settings.pollId) {
        pinnedPollIds.add(String(b.settings.pollId));
        const p = await prisma.poll.findUnique({ where: { id: String(b.settings.pollId) }, select: { id: true, question: true } });
        if (p) occ.push({ id: p.id, title: p.question, slug: '', kind: 'poll', place: row.name });
      } else if (b.type === 'quiz' && b.settings.quizId) {
        pinnedQuizIds.add(String(b.settings.quizId));
        const q = await prisma.quiz.findUnique({ where: { id: String(b.settings.quizId) }, select: { id: true, title: true } });
        if (q) occ.push({ id: q.id, title: q.title, slug: '', kind: 'quiz', place: row.name });
      }
    }
  }

  // Industry module aside: the generic active council poll + active Pop Quiz show
  // here — but only when NOT already pinned inside a custom module (the page yields
  // them via pinnedPollIds/pinnedQuizIds). Mirrors docs/page.tsx 'industry' case.
  if (enabled.has('industry')) {
    const poll = await prisma.poll.findFirst({ where: { active: true, kind: 'council' }, orderBy: { createdAt: 'desc' }, select: { id: true, question: true } });
    if (poll && !pinnedPollIds.has(poll.id)) occ.push({ id: poll.id, title: poll.question, slug: '', kind: 'poll', place: 'Industry aside' });
    const quiz = await prisma.quiz.findFirst({ where: { active: true, closesAt: { gt: now } }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } });
    if (quiz && !pinnedQuizIds.has(quiz.id)) occ.push({ id: quiz.id, title: quiz.title, slug: '', kind: 'quiz', place: 'Industry aside' });
  }

  // ---- Aggregate by id ----
  const byId = new Map<string, InventoryEntry>();
  for (const o of occ) {
    const e = byId.get(o.id) ?? { id: o.id, title: o.title, slug: o.slug, kind: o.kind, count: 0, places: [] };
    e.count++;
    e.places.push(o.place);
    byId.set(o.id, e);
  }
  const entries = [...byId.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { entries, totalSlots: occ.length, uniqueCount: entries.length, dupeCount: entries.filter((e) => e.count > 1).length };
}
