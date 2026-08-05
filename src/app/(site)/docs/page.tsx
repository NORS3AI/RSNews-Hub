import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { getPersonalizedFeed, trendingArticles, type ArticleCard as Card } from '@/lib/recommend';
import { getHomeLayout, moduleSource, type ModuleId, type HomeModule } from '@/lib/homepage';
import { isCustomModuleId, parseTree, type Block } from '@/lib/studio';
import { sweepExpiredModulePolls } from '@/lib/studioPolls';
import { shapeInnerClass, childWidthClass, rsStyle } from '@/components/site/CustomModule';
import FeatureCarousel from '@/components/site/FeatureCarousel';
import CouncilColumn from '@/components/site/CouncilColumn';
import ArticleCard from '@/components/ArticleCard';
import AdSlot from '@/components/AdSlot';
import InArticleAd from '@/components/InArticleAd';
import { loadAds } from '@/lib/adsServer';
import ArticleLink from '@/components/site/ArticleLink';
import SaveButtons from '@/components/site/StarButton';
import Carousel from '@/components/site/Carousel';
import { ArrowRight, Eye, Clock } from '@/components/icons';
import { formatDate } from '@/lib/utils';
import IndustryNews from '@/components/site/IndustryNews';
import PollCard from '@/components/site/PollCard';
import QuizCard from '@/components/site/QuizCard';
import ComicImage from '@/components/site/ComicImage';

export const dynamic = 'force-dynamic';

const cardSelect = {
  id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true,
  views: true, readMinutes: true,
  category: { select: { name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;
const toCard = (a: any): Card => ({ ...a, tags: (a.tags ?? []).map((t: any) => t.tag) });

export default async function DocsHome() {
  const [featuredRaw, latestRaw, categories, layout, industry, allAds] = await Promise.all([
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, featured: true }, orderBy: { publishedAt: 'desc' }, take: 3, select: cardSelect }),
    prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } }, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }], take: 20, select: cardSelect }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } } } } } } }),
    getHomeLayout(),
    prisma.industryLink.findMany({ where: { active: true }, orderBy: [{ order: 'asc' }, { postedAt: 'desc' }], take: 50 }),
    loadAds(),
  ]);

  const activePoll = await prisma.poll.findFirst({
    where: { active: true, kind: 'council' },
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
    where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, category: { slug: 'rs-council' }, requirement: '' },
    orderBy: { publishedAt: 'desc' },
    take: 12,
    select: { id: true, title: true, slug: true, content: true, publishedAt: true, author: { select: { name: true } } },
  });

  // All homepage-eligible comics; one is picked at random per request so the
  // module cycles through them on refresh.
  const activeComics = await prisma.comic.findMany({ where: { active: true }, orderBy: { postedAt: 'desc' } });
  const currentComic = activeComics.length ? activeComics[Math.floor(Math.random() * activeComics.length)] : null;

  // Homepage slots have no article context, so any advertiser is safe. Rotate
  // through the image creatives so the real ads show on the home page too.
  const homeImageAds = allAds.filter((a) => a.active && (a.imageWide || a.imageRect));
  let homeAdCursor = 0;
  const homeAd = (size: 'leaderboard' | 'rectangle', slot: string) => {
    if (!homeImageAds.length) return <AdSlot size={size} slot={slot} />;
    const ad = homeImageAds[homeAdCursor++ % homeImageAds.length];
    if (size === 'rectangle') return <InArticleAd ad={ad} slot={slot} size="rectangle" tone="orange" />;
    return <div className="mx-auto w-full max-w-[760px]"><InArticleAd ad={ad} slot={slot} size="in-article" tone="orange" /></div>;
  };

  const user = await getSessionUser();
  const sessionId = await getReaderSessionId();
  const [feed, trending] = await Promise.all([
    getPersonalizedFeed({ userId: user?.id, sessionId, limit: 12 }),
    trendingArticles(5),
  ]);

  // A logged-in reader may have already voted / answered — surface that so the
  // poll and quiz render their results/submitted state rather than re-prompting.
  const [priorPollVote, priorQuizResponse] = await Promise.all([
    user && activePoll ? prisma.pollVote.findUnique({ where: { pollId_userId: { pollId: activePoll.id, userId: user.id } }, select: { optionId: true } }) : Promise.resolve(null),
    user && activeQuiz ? prisma.quizResponse.findUnique({ where: { quizId_userId: { quizId: activeQuiz.id, userId: user.id } }, select: { id: true } }) : Promise.resolve(null),
  ]);
  const loggedIn = !!user;

  // Published custom modules (built in the Module Studio) referenced in the
  // layout. Only published ones ever reach the public homepage.
  const customIds = layout.filter((m) => m.enabled && isCustomModuleId(m.id)).map((m) => m.id.slice('custom:'.length));
  const customRows = customIds.length
    ? await prisma.customModule.findMany({ where: { id: { in: customIds }, published: true } })
    : [];
  const customById = new Map(customRows.map((r) => [`custom:${r.id}`, r]));

  // Poll lifecycle: close any module polls whose timer elapsed (hides them +
  // logs), then load the still-open ones referenced by these modules so they
  // render live and votable.
  await sweepExpiredModulePolls();
  const modulePollIds = customRows.flatMap((r) =>
    parseTree(r.tree).children.filter((b) => b.type === 'poll' && typeof b.settings.pollId === 'string').map((b) => b.settings.pollId as string));
  const modulePolls = modulePollIds.length
    ? await prisma.poll.findMany({ where: { id: { in: modulePollIds }, active: true }, include: { options: { orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } } } })
    : [];
  const modulePollById = new Map(modulePolls.map((p) => [p.id, p]));
  const myModuleVotes = user && modulePollIds.length
    ? await prisma.pollVote.findMany({ where: { userId: user.id, pollId: { in: modulePollIds } }, select: { pollId: true, optionId: true } })
    : [];
  const myModuleVoteByPoll = new Map(myModuleVotes.map((v) => [v.pollId, v.optionId]));

  const featured = featuredRaw.map(toCard);
  const all = latestRaw.map(toCard);
  const lead = featured[0] ?? all[0] ?? null;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = all.filter((a) => a.publishedAt && new Date(a.publishedAt).getTime() >= weekAgo).slice(0, 8);
  const latest = all.filter((a) => a.id !== lead?.id);

  // Article pools for configurable modules (e.g. the feature showcase).
  const featurePool = (source?: string): Card[] => {
    if (source === 'latest') return latest;
    if (source === 'trending') return trending as unknown as Card[];
    return featured.length ? featured : all.slice(0, 5); // 'featured'
  };

  // Render a published custom module (Module Studio) with REAL content. Article
  // blocks auto-fill from their source pool, de-duped within the module (a
  // future refinement can let admins hand-pick specific articles). Poll blocks
  // are skipped on the live site until the Phase 5 timer/archive lifecycle is
  // wired to real Poll records.
  const renderCustomModule = (row: { id: string; name: string; tree: string }, layoutId: string) => {
    const tree = parseTree(row.tree);
    const used = new Set<string>();
    const nextCard = (source: string): Card | null => {
      const pool = featurePool(source);
      for (const c of pool) if (!used.has(c.id)) { used.add(c.id); return c; }
      return null;
    };
    const kids = tree.children.map((b: Block, i: number) => {
      const style = rsStyle(b.rsColor);
      const wrap = (node: React.ReactNode) => <div key={b.id} className={childWidthClass(tree.shape)}>{node}</div>;
      switch (b.type) {
        case 'heading': {
          const t = String(b.settings.text ?? '');
          return wrap(b.settings.level === 3 ? <h3 className="text-lg font-bold tracking-tight">{t}</h3> : <h2 className="text-xl font-black tracking-tight">{t}</h2>);
        }
        case 'text':
          return wrap(<div className="prose-article text-[15px] leading-relaxed">{String(b.settings.body ?? '')}</div>);
        case 'ad':
          return wrap(<div className="studio-fill studio-ad flex justify-center rounded-xl" style={style}>{homeAd('rectangle', `custom-${row.id}-${i}`)}</div>);
        case 'article':
        case 'article-image': {
          const card = nextCard(String(b.settings.source ?? 'latest'));
          if (!card) return null;
          return wrap(
            <div className="studio-fill" style={style}>
              <ArticleCard article={card} compact={b.type === 'article'} trk={{ place: layoutId, props: { module: layoutId, moduleType: 'custom', pos: i } }} />
            </div>
          );
        }
        case 'poll': {
          const pid = typeof b.settings.pollId === 'string' ? b.settings.pollId : null;
          const p = pid ? modulePollById.get(pid) : null;
          if (!p) return null; // not materialized, or closed (timer elapsed) → hidden
          return wrap(
            <div className="studio-fill" style={style}>
              <PollCard poll={{ id: p.id, question: p.question, closesAt: p.closesAt, options: p.options }} loggedIn={loggedIn} votedOptionId={myModuleVoteByPoll.get(p.id) ?? null} />
            </div>
          );
        }
        default:
          return null; // any future block types
      }
    }).filter(Boolean);
    if (kids.length === 0) return null;
    return (
      <section key={layoutId} className="module studio-fill" style={rsStyle(tree.rsColor)}>
        <h2 className="module-title mb-4">{row.name}</h2>
        <div className={shapeInnerClass(tree.shape)}>{kids}</div>
      </section>
    );
  };

  const renderModule = (m: HomeModule) => {
    const id = m.id;
    switch (id) {
      case 'recommended':
        if (feed.length === 0) return null;
        return (
          <section key={id} className="module">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="module-title">{user ? 'Recommended for you' : 'You might like'}</h2>
              
            </div>
            <Carousel>
              {feed.map((a, i) => <ArticleCard key={a.id} article={a} trk={{ place: 'recommended', props: { module: 'recommended', moduleType: 'carousel', pos: i } }} />)}
            </Carousel>
          </section>
        );
      case 'feature-carousel': {
        const items = featurePool(moduleSource(m));
        if (!items.length) return null;
        return (
          <FeatureCarousel key={id} items={items.slice(0, 8).map((a) => ({
            slug: a.slug, title: a.title, excerpt: a.excerpt ?? null, coverImage: a.coverImage ?? null,
            category: a.category ? { name: a.category.name, color: a.category.color } : null,
          }))} />
        );
      }
      case 'council': {
        if (councilArticles.length === 0) return null;
        const councilEl = (
          <CouncilColumn items={councilArticles.map((a) => ({
            slug: a.slug, title: a.title, content: a.content, author: a.author?.name ?? null, publishedAt: a.publishedAt ? formatDate(a.publishedAt) : '',
          }))} />
        );
        // The column is intentionally narrow; fill the space beside it with ads.
        return (
          <div key={id} className="grid gap-6 lg:grid-cols-[minmax(0,30rem)_1fr] lg:items-start">
            {councilEl}
            <div className="flex flex-col gap-6">
              <div className="flex justify-center">{homeAd('leaderboard', 'council-ad-1')}</div>
              <div className="flex justify-center">{homeAd('rectangle', 'council-ad-2')}</div>
            </div>
          </div>
        );
      }
      case 'industry': {
        const hasIndustry = industry.length > 0;
        if (!hasIndustry && !activePoll && !activeQuiz) return null;
        const indEl = hasIndustry
          ? <IndustryNews links={industry.map((l) => ({ id: l.id, title: l.title, url: l.url, source: l.source, views: l.views, postedAt: l.postedAt }))} />
          : null;
        const pollEl = activePoll
          ? <PollCard poll={{ id: activePoll.id, question: activePoll.question, closesAt: activePoll.closesAt, options: activePoll.options }} loggedIn={loggedIn} votedOptionId={priorPollVote?.optionId ?? null} />
          : null;
        const quizEl = activeQuiz
          ? <QuizCard quiz={{ id: activeQuiz.id, title: activeQuiz.title, closesAt: activeQuiz.closesAt, questions: activeQuiz.questions }} loggedIn={loggedIn} initialDone={!!priorQuizResponse} />
          : null;
        // Poll + Pop Quiz stack together in the narrower right-hand column.
        const asideEl = (pollEl || quizEl) ? <div className="flex flex-col gap-6">{pollEl}{quizEl}</div> : null;
        if (indEl && asideEl) {
          return <div key={id} className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">{indEl}{asideEl}</div>;
        }
        return <div key={id}>{indEl ?? asideEl}</div>;
      }
      case 'comic':
        if (!currentComic) return null;
        return (
          <section key={id}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="module-title text-brand-600">Backroom Humor</h2>
              <Link href="/docs/archive/comics" className="text-sm font-semibold text-brand-600 hover:underline">View all comics</Link>
            </div>
            {/* Full-width slate card; the comic is centered, snug top/bottom. */}
            <div className="block rounded-2xl bg-[#2b333d] p-2 text-center shadow-modal">
              <ComicImage src={currentComic.image} alt={currentComic.title} className="mx-auto block max-h-[560px] w-auto max-w-full rounded-xl" />
            </div>
          </section>
        );
      case 'categories':
        if (categories.length === 0) return null;
        return (
          <section key={id} className="module">
            <div className="mb-4"><h2 className="module-title">Categories</h2></div>
            <div className="flex flex-wrap gap-2.5">
              {categories.map((c) => (
                <Link key={c.id} href={`/docs/category/${c.slug}`} className="tile rounded-full px-4 py-2 text-sm font-bold hover:shadow-[var(--shadow-hover)]" style={{ color: c.color }}>
                  {c.name} <span className="ml-1.5 text-[var(--muted)]">{c._count.articles}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      case 'trending':
        if (trending.length === 0) return null;
        return (
          <section key={id} className="module">
            <div className="mb-4"><h2 className="module-title">Trending</h2></div>
            <div className="divide-y divide-[var(--border)]">
              {trending.map((a, i) => (
                <ArticleLink key={a.id} slug={a.slug} className="flex items-center gap-3.5 py-3 hover:opacity-90"
                  data-trk-type="article" data-trk-id={a.id} data-trk-place="trending" data-trk-props={JSON.stringify({ module: 'trending', moduleType: 'list', pos: i, hasImage: false })}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{i + 1}</span>
                  <span className="flex-1 text-lg font-extrabold leading-tight tracking-tight">{a.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-[var(--muted)]"><Eye width={14} height={14} />{a.views}</span>
                </ArticleLink>
              ))}
            </div>
          </section>
        );
      case 'latest':
        return (
          <section key={id} className="module">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="module-title">Latest articles</h2>
              <Link href="/docs/archive" className="text-sm font-semibold text-brand-600 hover:underline">View archive</Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {latest.slice(0, 7).map((a, i) => (
                <div key={a.id} className="group relative">
                  <div className="absolute right-0 top-4 z-10"><SaveButtons item={{ id: a.id, title: a.title, slug: a.slug }} /></div>
                  <ArticleLink slug={a.slug} className="block py-4"
                    data-trk-type="article" data-trk-id={a.id} data-trk-place="latest" data-trk-props={JSON.stringify({ module: 'latest', moduleType: 'list', pos: i, hasImage: false })}>
                    {a.category && <span className="text-xs font-bold" style={{ color: a.category.color }}>{a.category.name}</span>}
                    <h3 className="mt-1 pr-[76px] text-[22px] font-extrabold leading-tight tracking-tight group-hover:text-brand-600">{a.title}</h3>
                    <div className="mt-2 flex items-center gap-3.5 text-xs text-[var(--muted)]">
                      <span>{formatDate(a.publishedAt)}</span>
                      <span className="flex items-center gap-1"><Clock width={13} height={13} />{a.readMinutes} min</span>
                      <span className="flex items-center gap-1"><Eye width={13} height={13} />{a.views}</span>
                    </div>
                  </ArticleLink>
                </div>
              ))}
            </div>
          </section>
        );
      case 'ad-leaderboard':
        return <div key={id} className="flex justify-center">{homeAd('leaderboard', 'home-leaderboard')}</div>;
      case 'ad-rectangles':
        return (
          <div key={id} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-center">{homeAd('rectangle', 'home-rect-1')}</div>
            <div className="flex justify-center">{homeAd('rectangle', 'home-rect-2')}</div>
            <div className="hidden justify-center lg:flex">{homeAd('rectangle', 'home-rect-3')}</div>
          </div>
        );
      default:
        if (isCustomModuleId(id)) {
          const row = customById.get(id);
          return row ? renderCustomModule(row, id) : null;
        }
        return null;
    }
  };

  // Category spotlights + more pools for extra scroll.
  const topCats = [...categories].sort((a, b) => b._count.articles - a._count.articles).slice(0, 3);
  const spotlights = topCats
    .map((c) => ({ cat: c, items: all.filter((a) => a.category?.slug === c.slug).slice(0, 10) }))
    .filter((s) => s.items.length > 0);

  const tagCounts = new Map<string, number>();
  for (const a of all) for (const t of a.tags) tagCounts.set(t.name, (tagCounts.get(t.name) ?? 0) + 1);
  const topics = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const picks = [...all].sort((a, b) => b.views - a.views);
  const quick = [...all].sort((a, b) => a.readMinutes - b.readMinutes);

  return (
    <div className="space-y-10 px-4 py-6 lg:space-y-[52px] lg:px-7 lg:py-8">
      {/* ===== Full-width headline ===== */}
      {lead && <Hero lead={lead} />}

      {/* ===== Orange "Published this week" ===== */}
      {recent.length > 0 && (
        <section className="module module-orange bg-brand-600 text-white">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="module-title text-white">Published this week</h2>
            <span className="text-sm font-semibold text-white/90">{recent.length} new</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((a) => (
              <div key={a.id} className="owk-card group relative flex flex-col rounded-2xl border border-white/25 bg-white/[.13] p-4 transition hover:-translate-y-0.5 hover:bg-white/20">
                <div className="absolute right-3 top-3 z-10 [&_button]:border-white/40 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25">
                  <SaveButtons item={{ id: a.id, title: a.title, slug: a.slug }} />
                </div>
                <ArticleLink slug={a.slug} className="flex flex-1 flex-col">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-white/85">{a.category?.name ?? 'News'}</span>
                  <h3 className="mt-1.5 pr-[76px] text-[22px] font-extrabold leading-tight tracking-tight">{a.title}</h3>
                  <div className="mt-auto flex items-center gap-3 pt-3 text-[13px] text-white/85">
                    <span>{formatDate(a.publishedAt)}</span>
                    <span>{a.readMinutes} min read</span>
                  </div>
                </ArticleLink>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Admin-arranged modules ===== */}
      {layout.filter((m) => m.enabled).map((m) => renderModule(m))}

      {/* ===== More content + interspersed ads ===== */}
      <div className="flex justify-center">{homeAd('leaderboard', 'home-mid')}</div>

      {spotlights.flatMap((s, i) => [
        <section key={s.cat.id} className="module">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="module-title" style={{ color: s.cat.color }}>In {s.cat.name}</h2>
            <Link href={`/docs/category/${s.cat.slug}`} className="text-sm font-semibold hover:underline" style={{ color: s.cat.color }}>
              See all {s.cat._count.articles}
            </Link>
          </div>
          <Carousel>{s.items.map((a, j) => <ArticleCard key={a.id} article={a} trk={{ place: `spotlight:${s.cat.slug}`, props: { module: 'spotlight', moduleType: 'carousel', category: s.cat.slug, pos: j } }} />)}</Carousel>
        </section>,
        i === 0 ? <div key="spotlight-ad" className="flex justify-center">{homeAd('leaderboard', 'home-spotlight')}</div> : null,
      ]).filter(Boolean)}

      {topics.length > 0 && (
        <section className="module">
          <div className="mb-4"><h2 className="module-title">Popular topics</h2></div>
          <div className="flex flex-wrap gap-2.5">
            {topics.map(([name, count]) => (
              <Link key={name} href={`/docs/search?q=${encodeURIComponent(name)}`} className="tile rounded-full px-4 py-2 text-sm font-bold hover:shadow-[var(--shadow-hover)]">
                #{name} <span className="ml-1.5 text-[var(--muted)]">{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="module">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="module-title">Editor&rsquo;s picks</h2>
            
          </div>
          <Carousel>{picks.map((a, i) => <ArticleCard key={a.id} article={a} trk={{ place: 'picks', props: { module: 'picks', moduleType: 'carousel', pos: i } }} />)}</Carousel>
        </section>
      )}

      <div className="flex justify-center">{homeAd('leaderboard', 'home-quick')}</div>

      <section className="module">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="module-title">Quick reads</h2>
          <span className="text-sm font-semibold text-[var(--muted)]">5 min or less</span>
        </div>
        <Carousel itemWidth="w-[240px] sm:w-[260px]">{quick.map((a, i) => <ArticleCard key={a.id} article={a} compact trk={{ place: 'quick', props: { module: 'quick', moduleType: 'carousel', pos: i } }} />)}</Carousel>
      </section>

      <section className="module">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="module-title">More to explore</h2>
          
        </div>
        <Carousel itemWidth="w-[240px] sm:w-[260px]">{all.map((a, i) => <ArticleCard key={a.id} article={a} compact trk={{ place: 'more', props: { module: 'more', moduleType: 'carousel', pos: i } }} />)}</Carousel>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex justify-center">{homeAd('rectangle', 'home-r1')}</div>
        <div className="flex justify-center">{homeAd('rectangle', 'home-r2')}</div>
        <div className="hidden justify-center lg:flex">{homeAd('rectangle', 'home-r3')}</div>
      </div>

      {/* Subscribe CTA */}
      <section className="module module-orange bg-brand-600 text-white">
        <div className="max-w-xl">
          <h2 className="text-2xl font-black">Never miss a story</h2>
          <p className="mt-2 text-white/90">Get the week&apos;s best articles delivered to your inbox. No spam, unsubscribe anytime.</p>
          <form action="/docs/subscriptions" className="mt-4 flex flex-wrap gap-2.5">
            <input type="email" placeholder="you@example.com" aria-label="Email"
              className="h-[46px] min-w-[220px] flex-1 rounded-xl border border-white/40 bg-white/15 px-3.5 text-white placeholder:text-white/60 outline-none" />
            <button className="btn bg-white text-brand-700 hover:bg-white/90">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Hero({ lead }: { lead: Card }) {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
      <div className="absolute right-3 top-3 z-10"><SaveButtons item={{ id: lead.id, title: lead.title, slug: lead.slug }} /></div>
      <ArticleLink slug={lead.slug} className="group grid md:grid-cols-[1.15fr_1fr]">
        <div className="relative grid min-h-[220px] place-items-center overflow-hidden bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] dark:from-[#33303a] dark:to-[#201d28] md:min-h-[380px]">
          {lead.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lead.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="select-none text-[110px] font-black tracking-tighter text-black/10 dark:text-white/10">RS</span>
          )}
        </div>
        <div className="flex flex-col justify-center p-7 sm:p-10">
          <div className="flex items-center gap-2.5">
            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200">Headline</span>
            {lead.category && <span className="text-[13px] font-bold" style={{ color: lead.category.color }}>{lead.category.name}</span>}
          </div>
          <h1 className="mt-4 text-4xl font-black leading-[1.06] tracking-[-0.03em] group-hover:text-brand-600 sm:text-[52px] xl:text-[58px]">{lead.title}</h1>
          {lead.excerpt && <p className="mt-[18px] max-w-[54ch] text-[17px] text-[var(--muted)]">{lead.excerpt}</p>}
          <div className="mt-[18px] flex items-center gap-2 text-[15px] font-extrabold text-brand-600">Read article <ArrowRight width={18} height={18} /></div>
        </div>
      </ArticleLink>
    </section>
  );
}
