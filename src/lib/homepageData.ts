// The homepage's entire DATA layer, extracted from the page component so the
// view is a pure function of this bundle. Everything here is async fetching +
// pure model derivation — no JSX, no request-local render cursors (those stay in
// the page: the ad-rotation cursor and the page-global "already shown" dedup
// sets are mutated *during* render). A future frontend (a native app, an
// AI-composed layout) can call getHomepageData() and render however it likes
// without touching a single query. See src/lib/cards.ts for the card DTO.

import { prisma } from './db';
import { getSessionUser, getReaderSessionId } from './auth';
import { getPersonalizedFeed, trendingWindowArticles, rediscoverArticles, mostRecommendedArticles } from './recommend';
import { getHomeLayout } from './homepage';
import { isCustomModuleId, parseTree, blockChain, inSchedule, isArticleSourced, collectionKey, type Block, type ModuleCollection } from './studio';
import { RECOMMENDABLE_STATUSES } from './constants';
import { canViewContent, brandKey, type AccountLike } from './entitlements';
import { activeViewAs } from './viewAsServer';
import { applyViewAs } from './viewAs';
import { sweepStudioExpiries } from './studioPolls';
import { sweepAutoArchivedArticles } from './autoArchive';
import { sweepSponsorGoLiveNotifications } from './intake';
import { getActiveSeasonalModuleIds } from './seasonalServer';
import { after } from 'next/server';
import { loadAds, listAdvertisers } from './adsServer';
import { cookies } from 'next/headers';
import { AD_PREVIEW_COOKIE } from '@/components/site/AdPreview';
import { getSupplierAdMap, savedVendorIds } from './suppliers';
import { isActiveVendor } from './vendors';
import { cardSelect, toCard, type ArticleCard as Card } from './cards';

/** Everything the homepage needs, fetched and derived once. The page turns this
 *  into React; any other UI could consume the same shape. */
export type HomepageData = Awaited<ReturnType<typeof getHomepageData>>;

export async function getHomepageData() {
  const [featuredRaw, latestRaw, sponsoredRaw, categories, layout, industry, allAds, supplierAdMap] = await Promise.all([
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, featured: true }, orderBy: { publishedAt: 'desc' }, take: 3, select: cardSelect }),
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } }, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }], take: 20, select: cardSelect }),
    // Active sponsors: paid window still open. Newest sponsor first (later end date
    // ≈ more recently started), then newest article — fair, stable ordering.
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, sponsoredUntil: { gt: new Date() } }, orderBy: [{ sponsoredUntil: 'desc' }, { publishedAt: 'desc' }], take: 12, select: cardSelect }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } } } }),
    getHomeLayout(),
    // postedAt<=now so a link edited to a future date can't surface early (the
    // digest already gates this way); id tiebreaker keeps same-timestamp order stable.
    prisma.industryLink.findMany({ where: { active: true, postedAt: { lte: new Date() } }, orderBy: [{ order: 'asc' }, { postedAt: 'desc' }, { id: 'desc' }], take: 50 }),
    loadAds(),
    getSupplierAdMap(),
  ]);

  // Council polls aren't swept to inactive on expiry (only module polls are), so
  // the query must itself exclude a poll past its timer — otherwise an expired
  // council poll stays pinned in the aside forever.
  const activePoll = await prisma.poll.findFirst({
    where: { active: true, kind: 'council', OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
    orderBy: { createdAt: 'desc' },
    include: { options: { orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } } },
  });

  // Active Pop Quiz within its 48-hour window. Correct flags are NOT selected —
  // the client must never see the answers.
  const activeQuiz = await prisma.quiz.findFirst({
    where: { active: true, closesAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { questions: { orderBy: { order: 'asc' }, select: { id: true, prompt: true, options: { orderBy: { order: 'asc' }, select: { id: true, label: true } } } } },
  });

  // RS Council columns — shown in full inside the tall column module. Because the
  // body is rendered inline on this public homepage, only UNGATED council pieces
  // appear here (requirement === ''); gated ones stay on their own page behind the
  // access gate and still show in listings with a lock badge.
  const councilArticles = await prisma.article.findMany({
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, category: { slug: 'rs-council-column' }, requirement: '' },
    orderBy: { publishedAt: 'desc' },
    take: 12,
    select: { id: true, title: true, slug: true, content: true, publishedAt: true, byline: true, bylineRef: { select: { name: true } }, author: { select: { name: true } } },
  });

  // The most-recent already-posted active comic shows on the homepage — matching
  // what the admin panel states ("Currently featured: X"). (Previously a random
  // pick per request, which both flickered on every refresh and contradicted the
  // admin's stated featured comic.) The postedAt<=now gate keeps a comic edited
  // to a future date from appearing early.
  const currentComic = await prisma.comic.findFirst({ where: { active: true, postedAt: { lte: new Date() } }, orderBy: { postedAt: 'desc' } });

  // Widths for the two pinned top sections (Hero, "Published this week"). Only
  // Full (3) or ⅔ (2); default full.
  const topSpanRows = await prisma.setting.findMany({ where: { key: { in: ['home_hero_span', 'home_week_span'] } } });
  const sectionSpan = (key: string) => (topSpanRows.find((r) => r.key === key)?.value === '2' ? 2 : 3);
  const heroSpan = sectionSpan('home_hero_span');
  const weekSpan = sectionSpan('home_week_span');

  const user = await getSessionUser();
  const isAdmin = !!user && (user.role === 'ADMIN' || user.role === 'EDITOR');
  // Admin "View as": when an admin is previewing the site as a member/vendor, the
  // preset overrides their entitlements for content gating (below) and — for a
  // vendor preset — drives the same on-homepage ad preview a vendor sees.
  const viewingAs = await activeViewAs(user);
  // Which premium suppliers this reader has already saved — powers the "in your
  // phone book" state on each ad's options menu.
  const savedSupplierIds = user ? await savedVendorIds(user.id) : [];

  // Homepage slots have no article context, so any advertiser is safe. Rotate
  // through the image creatives so the real ads show on the home page too.
  // Any active ad that carries at least one visual creative (banner, rectangle,
  // tall skyscraper, or video). homeAd() shape-filters this per slot, so a
  // tall-only or video-only creative never leaks into a banner/rectangle slot.
  const homeImageAds = allAds.filter((a) => a.active && (a.imageWide || a.imageRect || a.imageTall || a.video));

  // Vendor ad-preview: when a signed-in vendor toggled "Preview my ads" from
  // their dashboard, a cookie carries their normalized brand. We honor it ONLY
  // when the viewer IS that vendor, and fill each homepage slot they have a LIVE
  // creative for with their own ad (competitor-safe house fallback otherwise) —
  // a labeled demo so they see their placement + the slots they're missing.
  const previewCookie = (await cookies()).get(AD_PREVIEW_COOKIE)?.value || '';
  let previewBrand = '';
  let previewWide = false;
  let previewRect = false;
  if (previewCookie && user) {
    const acct = await prisma.user.findUnique({ where: { id: user.id }, select: { accountType: true, vendorBrand: true } });
    // Coupled to the premium switch: a de-listed vendor's ad preview stops
    // rendering, same as their dashboard closing.
    if (acct?.vendorBrand && brandKey(previewCookie) === brandKey(acct.vendorBrand) && (await isActiveVendor(acct))) {
      previewBrand = acct.vendorBrand;
      const mine = (await listAdvertisers()).find((a) => a.key === brandKey(previewBrand));
      previewWide = !!mine?.wide;
      previewRect = !!mine?.rect;
    }
  }
  // An admin viewing the site "as" a vendor sees that vendor's ad preview too,
  // even without the vendor-side preview cookie (identity is already verified as
  // admin by activeViewAs).
  if (!previewBrand && viewingAs?.group === 'Vendor' && viewingAs.account.vendorBrand) {
    previewBrand = viewingAs.account.vendorBrand;
    const mine = (await listAdvertisers()).find((a) => a.key === brandKey(previewBrand));
    previewWide = !!mine?.wide;
    previewRect = !!mine?.rect;
  }

  // The viewer's entitlement attributes, for element audience gates. Null when
  // signed out (gated elements then tease/hide for everyone unless public).
  const realAccount: AccountLike | null = user
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { accountType: true, tier: true, affiliations: true, vendorBrand: true } })
    : null;
  // View-as impersonates the entitlement attributes for gating; real identity is
  // untouched. When not impersonating, this is just the real account.
  const account: AccountLike | null = viewingAs ? applyViewAs(realAccount, viewingAs) : realAccount;
  const sessionId = await getReaderSessionId();
  const [feed, trending, mostRecommended] = await Promise.all([
    getPersonalizedFeed({ userId: user?.id, sessionId, limit: 12 }),
    trendingWindowArticles(5, 7),
    mostRecommendedArticles(8),
  ]);
  // "Rediscover" back-catalog picks, rotating daily. Exclude what Trending is
  // already showing so the two side-by-side slots don't echo each other.
  const rediscover = await rediscoverArticles(5, trending.map((t) => t.id));

  // A logged-in reader may have already voted / answered — surface that so the
  // poll and quiz render their results/submitted state rather than re-prompting.
  const [priorPollVote, priorQuizResponse] = await Promise.all([
    user && activePoll ? prisma.pollVote.findUnique({ where: { pollId_userId: { pollId: activePoll.id, userId: user.id } }, select: { optionId: true } }) : Promise.resolve(null),
    user && activeQuiz ? prisma.quizResponse.findUnique({ where: { quizId_userId: { quizId: activeQuiz.id, userId: user.id } }, select: { id: true } }) : Promise.resolve(null),
  ]);
  const loggedIn = !!user;

  // Published custom modules (built in the Module Studio) referenced in the
  // layout. Only published ones ever reach the public homepage. Seasonal modules
  // (recurring yearly windows open TODAY) are merged in here so their content
  // pools resolve exactly like a layout module — they render as a computed band
  // above the layout (see the page), without ever touching the saved layout.
  const seasonalActiveIds = await getActiveSeasonalModuleIds(new Date());
  const layoutCustomIds = layout.filter((m) => m.enabled && isCustomModuleId(m.id)).map((m) => m.id.slice('custom:'.length));
  const customIds = [...new Set([...layoutCustomIds, ...seasonalActiveIds])];
  const customRows = customIds.length
    ? await prisma.customModule.findMany({ where: { id: { in: customIds }, published: true } })
    : [];
  const customById = new Map(customRows.map((r) => [`custom:${r.id}`, r]));
  // The seasonal band, in priority order — only ids that resolved to a published
  // module (a dangling/unpublished seasonal reference is silently skipped).
  const seasonalModuleIds = seasonalActiveIds.map((id) => `custom:${id}`).filter((cid) => customById.has(cid));
  // Parse each module's tree ONCE for this request; both the block scan and the
  // collection prefetch below reuse it (parseTree runs a full normalize walk).
  const treeById = new Map(customRows.map((r) => [r.id, parseTree(r.tree)]));

  // Poll lifecycle: close any module polls whose timer elapsed (hides them +
  // logs), then load the still-open ones referenced by these modules so they
  // render live and votable.
  await sweepStudioExpiries();
  await sweepAutoArchivedArticles();
  // Low-latency trigger for the sponsor go-live email on SCHEDULED articles whose
  // publish time has passed — run after the response so a reader never waits on
  // email delivery. The nightly ads-maintenance cron is the backstop.
  after(() => sweepSponsorGoLiveNotifications().catch(() => {}));
  // Scans below flatten each block into its full priority stack (block +
  // fallbacks) so a poll/article/quiz that only appears as a *fallback* still
  // has its live content pre-fetched and can fill its slot when promoted.
  const allBlocks = customRows.flatMap((r) => treeById.get(r.id)!.children.flatMap(blockChain));
  const modulePollIds = allBlocks
    .filter((b) => b.type === 'poll' && typeof b.settings.pollId === 'string').map((b) => b.settings.pollId as string);
  const modulePolls = modulePollIds.length
    ? await prisma.poll.findMany({ where: { id: { in: modulePollIds } }, include: { options: { orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } } } })
    : [];
  const modulePollById = new Map(modulePolls.map((p) => [p.id, p]));
  const myModuleVotes = user && modulePollIds.length
    ? await prisma.pollVote.findMany({ where: { userId: user.id, pollId: { in: modulePollIds } }, select: { pollId: true, optionId: true } })
    : [];
  const myModuleVoteByPoll = new Map(myModuleVotes.map((v) => [v.pollId, v.optionId]));

  // Resolve the non-pool article sourcing modes used by custom-module article
  // blocks: hand-picked ids, by-tag, and by-year (throwbacks).
  // Article-sourced blocks (incl. spotlight/split) need pick/tag/year/category
  // pools prefetched or those modes resolve empty and the element renders blank.
  // isArticleSourced() is the single source of truth (shared with the inventory).
  const artBlocks = allBlocks.filter((b) => isArticleSourced(b.type));
  const pickIds = [...new Set(artBlocks.filter((b) => b.settings.mode === 'pick' && typeof b.settings.articleId === 'string').map((b) => b.settings.articleId as string))];
  const tags = [...new Set(artBlocks.filter((b) => b.settings.mode === 'tag' && b.settings.tag).map((b) => String(b.settings.tag).trim().toLowerCase()))];
  const years = [...new Set(artBlocks.filter((b) => b.settings.mode === 'year' && Number(b.settings.year) > 0).map((b) => Number(b.settings.year)))];
  const cats = [...new Set(artBlocks.filter((b) => b.settings.mode === 'category' && b.settings.categorySlug).map((b) => String(b.settings.categorySlug).trim().toLowerCase()))];

  // Hand-picked stories must still honor the schedule: a PUBLISHED article dated
  // in the future is not yet public even when an admin pins it. The OR keeps
  // ARCHIVED rows whose publishedAt is null (archived straight from draft).
  const pickRows = pickIds.length ? await prisma.article.findMany({ where: { id: { in: pickIds }, status: { in: RECOMMENDABLE_STATUSES }, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] }, select: cardSelect }) : [];
  const pickById = new Map(pickRows.map((a) => [a.id, toCard(a)]));
  const byTag = new Map<string, Card[]>();
  await Promise.all(tags.map(async (t) => {
    const rows = await prisma.article.findMany({
      where: { status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() }, tags: { some: { tag: { OR: [{ slug: { contains: t } }, { name: { contains: t } }] } } } },
      orderBy: { publishedAt: 'desc' }, take: 12, select: cardSelect,
    });
    byTag.set(t, rows.map(toCard));
  }));
  const byYear = new Map<number, Card[]>();
  await Promise.all(years.map(async (y) => {
    // Cap the window at "now" so a story scheduled for later THIS year can't
    // surface early in the current-year throwback module.
    const upper = Math.min(new Date(y + 1, 0, 1).getTime(), Date.now());
    const rows = await prisma.article.findMany({
      where: { status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { gte: new Date(y, 0, 1), lt: new Date(upper) } },
      orderBy: { publishedAt: 'desc' }, take: 12, select: cardSelect,
    });
    byYear.set(y, rows.map(toCard));
  }));
  // Category source → newest published in that category (primary OR extra).
  const byCat = new Map<string, Card[]>();
  await Promise.all(cats.map(async (slug) => {
    const rows = await prisma.article.findMany({
      where: {
        status: { in: RECOMMENDABLE_STATUSES }, publishedAt: { lte: new Date() },
        OR: [{ category: { slug } }, { extraCategories: { some: { slug } } }],
      },
      orderBy: { publishedAt: 'desc' }, take: 12, select: cardSelect,
    });
    byCat.set(slug, rows.map(toCard));
  }));

  // Module-level article collections: one shared pool per distinct query so
  // identical collections across modules reuse a single fetch. AND-combines the
  // category (primary OR extra) with any-of tags and an optional year; a generous
  // pool (40) gives daily rotation room to cycle. Mirrors homepageInventory.
  const collections = new Map<string, ModuleCollection>();
  for (const r of customRows) { const c = treeById.get(r.id)!.collection; if (c) collections.set(collectionKey(c), c); }
  const byCollection = new Map<string, Card[]>();
  await Promise.all([...collections.entries()].map(async ([key, c]) => {
    const rows = await prisma.article.findMany({
      where: {
        status: { in: RECOMMENDABLE_STATUSES },
        OR: [{ category: { slug: c.categorySlug } }, { extraCategories: { some: { slug: c.categorySlug } } }],
        ...(c.tags.length ? { tags: { some: { tag: { OR: c.tags.flatMap((t) => [{ slug: { contains: t } }, { name: { contains: t } }]) } } } } : {}),
        ...(c.genre ? { genre: c.genre } : {}),
        ...(c.year
          ? { publishedAt: { gte: new Date(c.year, 0, 1), lt: new Date(Math.min(new Date(c.year + 1, 0, 1).getTime(), Date.now())) } }
          : { publishedAt: { lte: new Date() } }),
      },
      orderBy: c.sort === 'recommended' ? [{ recommends: 'desc' as const }, { publishedAt: 'desc' as const }]
        : c.sort === 'views' ? [{ views: 'desc' as const }, { publishedAt: 'desc' as const }]
        : [{ publishedAt: 'desc' as const }],
      take: 40, select: cardSelect,
    });
    byCollection.set(key, rows.map(toCard));
  }));

  // Resolve hand-picked quizzes referenced by quiz elements (answers never selected).
  const quizIds = [...new Set(allBlocks.filter((b) => b.type === 'quiz' && b.settings.quizId).map((b) => String(b.settings.quizId)))];
  const pickedQuizzes = quizIds.length
    // `active: true` so a retired quiz (auto-deactivated when a newer one goes
    // live) with a still-future closesAt can't render as an open, votable card
    // that then 403s on submit — mirrors the activeQuiz query and the poll rung.
    ? await prisma.quiz.findMany({ where: { id: { in: quizIds }, active: true }, include: { questions: { orderBy: { order: 'asc' }, select: { id: true, prompt: true, options: { orderBy: { order: 'asc' }, select: { id: true, label: true } } } } } })
    : [];
  const quizById = new Map(pickedQuizzes.map((q) => [q.id, q]));
  const myQuizDone = user && quizIds.length
    ? new Set((await prisma.quizResponse.findMany({ where: { userId: user.id, quizId: { in: quizIds } }, select: { quizId: true } })).map((r) => r.quizId))
    : new Set<string>();

  const featured = featuredRaw.map(toCard);
  const all = latestRaw.map(toCard);
  const sponsored = sponsoredRaw.map(toCard);
  const lead = featured[0] ?? all[0] ?? null;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = all.filter((a) => a.publishedAt && new Date(a.publishedAt).getTime() >= weekAgo).slice(0, 8);
  const latest = all.filter((a) => a.id !== lead?.id);
  // The Featured (sponsored) module shows an active sponsor ONLY once it has
  // dropped out of the prominent top sections — hero, "this week", trending — so
  // it never double-shows there and never crowds them. Built after trending.
  const topSectionIds = new Set<string>([lead?.id, ...recent.map((a) => a.id), ...trending.map((t) => t.id)].filter(Boolean) as string[]);

  // The generic council aside yields (hides its poll/quiz) only to a module that
  // will ACTUALLY render it — i.e. a PRIMARY (top-level) block, not a fallback.
  // A fallback that names the active poll may never be reached; if we let those
  // ids suppress the aside too, the poll would render nowhere. So build these
  // "pinned" sets from primary blocks only (allBlocks above includes fallbacks
  // for pre-fetching, which is still what we want for the pool queries).
  const primaryBlocks = customRows.flatMap((r) => parseTree(r.tree).children);
  // A poll/quiz id "pins" (suppresses the generic council aside) ONLY when its
  // primary block will actually render it for THIS viewer — i.e. it's inside its
  // schedule window and the viewer meets any audience gate. Otherwise the block
  // renders nothing (future window) or a locked teaser (gated), and the poll must
  // still surface in the aside instead of vanishing from the page entirely.
  const nowPin = Date.now();
  const pinnable = (b: Block) => inSchedule(b, nowPin) && (!b.requirement || canViewContent(account, b.requirement));
  const pinnedPollIds = new Set(primaryBlocks.filter((b) => b.type === 'poll' && typeof b.settings.pollId === 'string' && b.settings.pollId && pinnable(b)).map((b) => b.settings.pollId as string));
  const pinnedQuizIds = new Set(primaryBlocks.filter((b) => b.type === 'quiz' && b.settings.quizId && pinnable(b)).map((b) => String(b.settings.quizId)));

  return {
    // viewer / entitlements
    user, account, isAdmin, loggedIn,
    // supplier + ad inventory (render-cursor stays in the page)
    savedSupplierIds, supplierAdMap, homeImageAds, previewBrand, previewWide, previewRect,
    // article pools + derived groupings
    featured, all, sponsored, lead, recent, latest,
    trending, mostRecommended, rediscover, feed, topSectionIds,
    // layout + misc content
    categories, layout, industry, activePoll, activeQuiz, councilArticles, currentComic,
    heroSpan, weekSpan, priorPollVote, priorQuizResponse,
    // custom modules + their resolved content pools
    customById, pickById, byTag, byYear, byCat, byCollection,
    // seasonal band (custom:<id> in priority order) — active recurring modules
    seasonalModuleIds,
    modulePollById, myModuleVoteByPoll, quizById, myQuizDone,
    pinnedPollIds, pinnedQuizIds,
  };
}
