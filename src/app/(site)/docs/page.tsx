import Link from 'next/link';
import { getHomepageData } from '@/lib/homepageData';
import { type ArticleCard as Card } from '@/lib/cards';
import { moduleSource, clampSpan, MODULE_CATALOG, type ModuleId, type HomeModule } from '@/lib/homepage';
import { isCustomModuleId, parseTree, blockChain, inSchedule, type Block } from '@/lib/studio';
import { canViewContent, requirementLabel, brandKey } from '@/lib/entitlements';
import { isPartnerContent, PartnerContentBadge } from '@/components/ArticleBadges';
import { Lock } from '@/components/icons';
import { ModuleShell, shapeContainerClass, rsStyle, Eyebrow } from '@/components/site/CustomModule';
import FeatureCarousel from '@/components/site/FeatureCarousel';
import CouncilColumn from '@/components/site/CouncilColumn';
import ArticleCard from '@/components/ArticleCard';
import AdWithOptions from '@/components/site/AdWithOptions';
import ArticleLink from '@/components/site/ArticleLink';
import SaveButtons from '@/components/site/StarButton';
import Carousel from '@/components/site/Carousel';
import { ArrowRight, Eye, Clock } from '@/components/icons';
import { formatDate } from '@/lib/utils';
import IndustryNews from '@/components/site/IndustryNews';
import SubscribeLauncher from '@/components/site/SubscribeLauncher';
import PollCard from '@/components/site/PollCard';
import HomeArrangeGrid from '@/components/site/HomeArrangeGrid';
import CoverVideo from '@/components/site/CoverVideo';
import Countdown from '@/components/site/Countdown';
import SectionWidth from '@/components/site/SectionWidth';
import AdminArticleEdit, { AdminEditProvider } from '@/components/site/AdminArticleEdit';
import HomepageHighlight from '@/components/site/HomepageHighlight';
import EndlessFeed from '@/components/site/EndlessFeed';
import ScrollReveal from '@/components/site/ScrollReveal';
import QuizCard from '@/components/site/QuizCard';
import ComicImage from '@/components/site/ComicImage';

export const dynamic = 'force-dynamic';

// The access-gate lock badge, matching ArticleCard/ArticleBadges. Custom article
// markup (headline/spotlight/split) must show it too, so a members-only story
// hand-picked into one of those slots is still labelled (parity, not a body leak —
// the body stays gated behind canViewContent on click).
function LockBadge({ requirement }: { requirement?: string }) {
  if (!requirement) return null;
  return <span className="badge inline-flex items-center gap-1 bg-amber-100 text-amber-800"><Lock width={12} height={12} /> {requirementLabel(requirement)}</span>;
}

export default async function DocsHome() {
  // The homepage's entire data layer — fetched and derived once, in lib. The rest
  // of this component is a pure renderer over `data` plus a little request-local
  // render state (the ad-rotation cursor and the "already shown" dedup sets below).
  const data = await getHomepageData();
  const {
    user, account, isAdmin, loggedIn,
    savedSupplierIds, supplierAdMap, homeImageAds, previewBrand, previewWide, previewRect,
    featured, all, sponsored, lead, recent, latest,
    trending, mostRecommended, rediscover, feed, topSectionIds,
    categories, layout, industry, activePoll, activeQuiz, councilArticles, currentComic,
    heroSpan, weekSpan, priorPollVote, priorQuizResponse,
    customById, pickById, byTag, byYear, byCat,
    modulePollById, myModuleVoteByPoll, quizById, myQuizDone,
    pinnedPollIds, pinnedQuizIds,
  } = data;

  // Ad-rotation cursor — request-local render state, mutated as each slot is
  // filled so successive slots rotate through the creative pool.
  let homeAdCursor = 0;

  // `brand` locks the slot to one advertiser (a sponsor spotlight). If that
  // advertiser has no live creative, we fall back to an RS house ad (our own —
  // never another advertiser, so a sold slot can never show a competitor); only
  // if we have no house image ad either does it fall through (null).
  const homeAd = (size: 'leaderboard' | 'rectangle' | 'video' | 'skyscraper', slot: string, brand?: string): React.ReactNode | null => {
    // In vendor preview, an auto banner/rectangle slot the vendor can fill is
    // locked to their brand (video/skyscraper have no vendor-preview creatives).
    const previewLock = !brand && !!previewBrand && ((size === 'leaderboard' && previewWide) || (size === 'rectangle' && previewRect));
    const lockBrand = brand || (previewLock ? previewBrand : undefined);
    let pool = lockBrand ? homeImageAds.filter((a) => brandKey(a.brand) === brandKey(lockBrand)) : homeImageAds;
    // Which creative each slot shape needs. Video accepts a video creative OR a
    // wide image (shown 16:9); skyscraper REQUIRES a tall creative.
    const shapeOk = (a: typeof homeImageAds[number]) =>
      size === 'leaderboard' ? !!a.imageWide
        : size === 'video' ? (!!a.video || !!a.imageWide)
          : size === 'skyscraper' ? !!a.imageTall
            : (!!a.imageRect || !!a.video); // rectangle also plays a video creative
    // Every slot only serves a creative that actually fits its shape — the pool
    // now mixes banner/rectangle/tall/video ads, and a mismatched creative would
    // render blank or wrongly-cropped. So shape-filter unconditionally. A public
    // homepage must never show an empty ad box, so an empty pool renders nothing.
    pool = pool.filter(shapeOk);
    if (lockBrand && pool.length === 0) {
      // Fallback is EXPLICIT house ads only (a.house) — NEVER "no flight" (!flightId),
      // because an always-on outside advertiser has no flight and would be a rival
      // in a vendor-locked slot. Mirrors pickInArticleAd's hard lock (ads.ts). If no
      // shape-correct house ad exists, the slot collapses rather than risk a competitor.
      pool = homeImageAds.filter((a) => a.house).filter(shapeOk);
    }
    if (pool.length === 0) return null;
    const ad = pool[homeAdCursor++ % pool.length];
    const iaSize = size === 'leaderboard' ? 'in-article' : size; // rectangle|video|skyscraper pass through
    // Homepage ads fill their slot: rectangles fill their grid column, banners
    // stretch the full content width (no centered max-width cap). Premium
    // suppliers also get a small ⋯ options menu (supplier page · site · save).
    // placeholder=false guarantees no filler box ever reaches a reader here.
    return (
      <AdWithOptions
        ad={ad} suppliers={supplierAdMap} savedIds={savedSupplierIds} signedIn={!!user}
        slot={slot} size={iaSize} tone="orange" fill placeholder={false}
      />
    );
  };

  // Article pools for configurable modules (e.g. the feature showcase).
  const featurePool = (source?: string): Card[] => {
    if (source === 'latest') return latest;
    if (source === 'trending') return trending as unknown as Card[];
    if (source === 'most-recommended') return mostRecommended as unknown as Card[];
    return featured.length ? featured : all.slice(0, 5); // 'featured'
  };

  // Render a published custom module (Module Studio) with REAL content. Article
  // blocks auto-fill from their source pool, de-duped within the module (a
  // future refinement can let admins hand-pick specific articles). Poll blocks
  // are skipped on the live site until the Phase 5 timer/archive lifecycle is
  // wired to real Poll records.
  // Global de-dup across the homepage. Polls/quizzes show at most once anywhere:
  // explicitly-pinned poll/quiz ids (resolved in getHomepageData) win over the
  // generic council aside; among modules, first in layout order wins — a
  // duplicate falls through its fallback chain. Articles are deduped across
  // custom modules AND the generic "Latest" list. The curated ranking views
  // (Trending, Rediscover) and carousels are intentional standalone selections
  // and may re-surface a story by design — they don't consume this set.
  // Seed the page-global article dedup with the stories already shown in the
  // prominent top sections — the hero lead and the "Published this week" band —
  // so they can't reappear in Latest or a custom module below. (Trending is a
  // deliberate standalone ranking and intentionally does NOT consume this set.)
  const shownArticleIds = new Set<string>([lead?.id, ...recent.map((a) => a.id)].filter(Boolean) as string[]);
  const shownPollIds = new Set<string>();
  const shownQuizIds = new Set<string>();

  const renderCustomModule = (row: { id: string; name: string; tree: string }, layoutId: string) => {
    const tree = parseTree(row.tree);
    const used = shownArticleIds; // page-global so articles don't repeat across modules
    const firstUnused = (pool: Card[]): Card | null => {
      for (const c of pool) if (!used.has(c.id)) { used.add(c.id); return c; }
      return null;
    };
    // Resolve an article block's story by its sourcing mode.
    const resolveArticle = (b: Block): Card | null => {
      const mode = b.settings.mode ?? 'auto';
      if (mode === 'pick') {
        const a = pickById.get(String(b.settings.articleId ?? ''));
        if (a) used.add(a.id); // a hand-picked story always shows, even if repeated
        return a ?? null;
      }
      if (mode === 'tag') return firstUnused(byTag.get(String(b.settings.tag ?? '').trim().toLowerCase()) ?? []);
      if (mode === 'year') return firstUnused(byYear.get(Number(b.settings.year)) ?? []);
      if (mode === 'category') return firstUnused(byCat.get(String(b.settings.categorySlug ?? '').trim().toLowerCase()) ?? []);
      return firstUnused(featurePool(String(b.settings.source ?? 'latest')));
    };
    // Render ONE rung of a slot's priority stack — the block's live content, or
    // null when it has nothing to show (poll not running, picked article
    // unpublished, empty image…). Returning null is the signal to try the next
    // fallback. `style` is the slot's background so the look holds across rungs.
    const nowMs = Date.now();
    const renderRung = (b: Block, i: number, style: React.CSSProperties | undefined): React.ReactNode | null => {
      // Outside its schedule window → treat as unavailable so the slot falls
      // through to the next rung (which restores the "previous" content).
      if (!inSchedule(b, nowMs)) return null;
      // Audience gate: a viewer who doesn't meet the requirement either sees a
      // locked teaser (tease, drives upgrades) or nothing (swap → fall through).
      if (b.requirement && !canViewContent(account, b.requirement)) {
        if (b.gateMode === 'swap') return null;
        return (
          <div className="studio-fill grid place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-2)] p-6 text-center" style={style}>
            <Lock width={20} height={20} className="mb-2 text-brand-600" />
            <p className="text-sm font-bold">{requirementLabel(b.requirement)} only</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Sign in or upgrade to unlock this.</p>
            <Link href="/docs/subscriptions" className="btn-primary btn-sm mt-3">Unlock</Link>
          </div>
        );
      }
      switch (b.type) {
        case 'heading': {
          const t = String(b.settings.text ?? '');
          return b.settings.level === 3 ? <h3 className="text-lg font-bold tracking-tight">{t}</h3> : <h2 className="text-xl font-black tracking-tight">{t}</h2>;
        }
        case 'text':
          return <div className="prose-article text-[15px] leading-relaxed">{String(b.settings.body ?? '')}</div>;
        case 'ad': {
          const raw = String(b.settings.format ?? 'rectangle');
          const fmt = raw === 'leaderboard' ? 'leaderboard' : raw === 'video' ? 'video' : raw === 'vertical' ? 'skyscraper' : 'rectangle';
          const brand = typeof b.settings.vendor === 'string' ? b.settings.vendor.trim() : '';
          const adNode = homeAd(fmt, `custom-${row.id}-${i}`, brand || undefined);
          if (!adNode) return null; // vendor-locked slot, advertiser has no live creative → fall through
          return <div className="studio-fill studio-ad flex justify-center rounded-xl" style={style}>{adNode}</div>;
        }
        case 'image': {
          const url = String(b.settings.url ?? '');
          if (!url) return null;
          const w = Number(b.settings.widthPct) || 100;
          const radius = b.settings.radius !== false;
          // eslint-disable-next-line @next/next/no-img-element
          return <img src={url} alt={String(b.settings.alt ?? '')} style={{ width: `${w}%` }} className={`h-auto max-w-none ${radius ? 'rounded-xl' : ''}`} />;
        }
        case 'video': {
          const url = String(b.settings.url ?? '');
          if (!url) return null;
          const w = Number(b.settings.widthPct) || 100;
          const radius = b.settings.radius !== false;
          return <CoverVideo src={url} poster={String(b.settings.poster ?? '') || null} style={{ width: `${w}%` }} className={`h-auto max-w-none ${radius ? 'rounded-xl' : ''}`} />;
        }
        case 'countdown': {
          const target = String(b.settings.targetAt ?? '');
          if (!target) return null; // no date set → fall through
          const cdTitle = String(b.settings.title ?? '');
          const cdHref = String(b.settings.href ?? '');
          const doneLabel = String(b.settings.doneLabel ?? '') || "It's here!";
          return (
            <div className="studio-fill flex flex-col items-center gap-4 py-2" style={style}>
              {cdTitle && <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">{cdTitle}</h2>}
              <Countdown target={target} variant="big" doneLabel={doneLabel} />
              {cdHref && <Link href={cdHref} className="btn-primary btn-sm">Learn more →</Link>}
            </div>
          );
        }
        case 'quiz': {
          const qid = b.settings.quizId ? String(b.settings.quizId) : '';
          const quiz = qid ? quizById.get(qid) : activeQuiz;
          if (!quiz) return null;
          // Once its timer ends, the quiz disappears from the homepage.
          if (quiz.closesAt && new Date(quiz.closesAt) < new Date()) return null;
          if (shownQuizIds.has(quiz.id)) return null; // already shown → fall through
          shownQuizIds.add(quiz.id);
          const done = qid ? myQuizDone.has(qid) : !!priorQuizResponse;
          return (
            <div className="studio-fill" style={style}>
              <QuizCard quiz={{ id: quiz.id, title: quiz.title, closesAt: quiz.closesAt, questions: quiz.questions }} loggedIn={loggedIn} initialDone={done} />
            </div>
          );
        }
        case 'article':
        case 'article-image':
        case 'article-headline': {
          const card = resolveArticle(b);
          if (!card) return null;
          if (b.type === 'article-headline') {
            return (
              <article data-hp-id={card.id} className="studio-fill card group relative overflow-hidden p-3.5" style={style}>
                <AdminArticleEdit id={card.id} pos="right-2 top-2" />
                {/* A tag so a headline-only element still reads as an article
                    (its category chip, or a plain "Article" fallback). */}
                {card.category
                  ? <span className="badge cat-badge" style={{ '--c': card.category.color } as React.CSSProperties}>{card.category.name}</span>
                  : <span className="badge bg-brand-600/15 text-brand-600">Article</span>}
                <LockBadge requirement={card.requirement} />
                {isPartnerContent(card) && <PartnerContentBadge />}
                <ArticleLink slug={card.slug} className="studio-fit mt-1.5 block font-black leading-tight tracking-tight hover:text-brand-600">{card.title}</ArticleLink>
              </article>
            );
          }
          return (
            <div className="studio-fill" style={style}>
              <ArticleCard article={card} compact={b.type === 'article'} trk={{ place: layoutId, props: { module: layoutId, moduleType: 'custom', pos: i } }} />
            </div>
          );
        }
        case 'spotlight': {
          const card = resolveArticle(b);
          if (!card) return null;
          const overlay = b.settings.overlay !== false;
          return (
            <div data-hp-id={card.id} className="studio-fill group relative" style={style}>
              <AdminArticleEdit id={card.id} />
              <ArticleLink slug={card.slug} className="relative block overflow-hidden rounded-2xl border border-[var(--border)]">
                <div className="aspect-[16/9] w-full bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] dark:from-[#33303a] dark:to-[#201d28]">
                  {card.coverImage
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={card.coverImage} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" style={card.coverFocus ? { objectPosition: card.coverFocus } : undefined} />
                    : <span className="grid h-full w-full place-items-center text-[90px] font-black text-black/10 dark:text-white/10">RS</span>}
                </div>
                <div className={overlay ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5' : 'p-4'}>
                  {card.category && <span className="badge cat-badge" style={{ '--c': card.category.color } as React.CSSProperties}>{card.category.name}</span>}
                  <LockBadge requirement={card.requirement} />
                  {isPartnerContent(card) && <PartnerContentBadge />}
                  <h3 className={`mt-1.5 text-2xl font-black leading-tight tracking-tight ${overlay ? 'text-white group-hover:text-brand-300' : 'group-hover:text-brand-600'}`}>{card.title}</h3>
                  {b.settings.showDek !== false && card.excerpt && <p className={`mt-1 line-clamp-2 text-sm ${overlay ? 'text-white/80' : 'text-[var(--muted)]'}`}>{card.excerpt}</p>}
                </div>
              </ArticleLink>
            </div>
          );
        }
        case 'split': {
          const card = resolveArticle(b);
          if (!card) return null;
          const right = b.settings.imageSide === 'right';
          const img = (
            <div className="min-h-[160px] w-full overflow-hidden bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] dark:from-[#33303a] dark:to-[#201d28]">
              {card.coverImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={card.coverImage} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" style={card.coverFocus ? { objectPosition: card.coverFocus } : undefined} />
                : <span className="grid h-full w-full place-items-center text-[70px] font-black text-black/10 dark:text-white/10">RS</span>}
            </div>
          );
          const body = (
            <div className="flex flex-col justify-center p-5">
              <span className="flex flex-wrap items-center gap-2">
                {card.category && <span className="badge cat-badge self-start" style={{ '--c': card.category.color } as React.CSSProperties}>{card.category.name}</span>}
                <LockBadge requirement={card.requirement} />
                {isPartnerContent(card) && <PartnerContentBadge />}
              </span>
              <h3 className="mt-1.5 text-xl font-black leading-tight tracking-tight group-hover:text-brand-600">{card.title}</h3>
              {b.settings.showDek !== false && card.excerpt && <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">{card.excerpt}</p>}
            </div>
          );
          return (
            <div data-hp-id={card.id} className="studio-fill group relative" style={style}>
              <AdminArticleEdit id={card.id} />
              <ArticleLink slug={card.slug} className="grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] sm:grid-cols-2">
                {right ? <>{body}{img}</> : <>{img}{body}</>}
              </ArticleLink>
            </div>
          );
        }
        case 'mosaic': {
          const count = Math.min(Math.max(Number(b.settings.count) || 4, 3), 6);
          const pool = featurePool(String(b.settings.source ?? 'latest'));
          const cards: Card[] = [];
          for (const c of pool) { if (cards.length >= count) break; if (!used.has(c.id)) { used.add(c.id); cards.push(c); } }
          if (cards.length === 0) return null;
          return (
            <div className="studio-fill grid grid-cols-2 gap-3 sm:grid-cols-3" style={style}>
              {cards.map((card, k) => <ArticleCard key={card.id} article={card} compact trk={{ place: layoutId, props: { module: layoutId, moduleType: 'custom', pos: k } }} />)}
            </div>
          );
        }
        case 'poll': {
          const pid = typeof b.settings.pollId === 'string' ? b.settings.pollId : null;
          const p = pid ? modulePollById.get(pid) : null;
          if (!p) return null; // not materialized → hidden
          // Once its timer ends (or an admin deactivates it), the poll leaves the
          // slot so the block falls through to its fallback — mirroring the quiz
          // rung. Without this a closed poll stayed stuck in its module forever.
          if (!p.active || (p.closesAt && new Date(p.closesAt) < new Date())) return null;
          if (shownPollIds.has(p.id)) return null; // already shown elsewhere → fall through
          shownPollIds.add(p.id);
          return (
            <div className="studio-fill" style={style}>
              <PollCard poll={{ id: p.id, question: p.question, closesAt: p.closesAt, options: p.options }} loggedIn={loggedIn} votedOptionId={myModuleVoteByPoll.get(p.id) ?? null} chart={b.settings.chart === 'pie' ? 'pie' : 'bar'} />
            </div>
          );
        }
        default:
          return null; // any future block types
      }
    };
    // Each slot walks its priority stack and shows the first rung that can fill —
    // so a slot is only ever *replaced*, never left empty (as long as its last
    // rung is an un-emptiable type like an ad or an auto/latest article).
    const kids = tree.children.map((slot: Block, i: number) => {
      const style = rsStyle(slot.rsColor);
      for (const rung of blockChain(slot)) {
        const node = renderRung(rung, i, rung.rsColor ? rsStyle(rung.rsColor) : style);
        if (node) return { key: slot.id, node: <><Eyebrow label={rung.label ?? slot.label} />{node}</> };
      }
      return null;
    }).filter(Boolean) as { key: string; node: React.ReactNode }[];
    if (kids.length === 0) return null;
    // A single poll/quiz already carries its own header, so don't repeat the
    // module name above it (avoids the title == poll-question duplication).
    // A lone poll/quiz carries its own header, so we skip the module title. But
    // if it has fallbacks it might resolve to an article instead, so only treat
    // it as self-headed when there's no chance of a fallback taking the slot.
    const solo = tree.children.length === 1 ? tree.children[0] : null;
    const soloSelfHeader = !!solo && !solo.fallbacks?.length && (solo.type === 'poll' || solo.type === 'quiz');
    return (
      <section key={layoutId} className={`module studio-fill ${shapeContainerClass(tree.shape)}`} style={rsStyle(tree.rsColor)}>
        {!soloSelfHeader && <h2 className="module-title mb-4">{row.name}</h2>}
        <ModuleShell shape={tree.shape} items={kids} />
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
            id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt ?? null, coverImage: a.coverImage ?? null, coverFocus: a.coverFocus ?? null,
            category: a.category ? { name: a.category.name, color: a.category.color } : null,
          }))} />
        );
      }
      case 'council': {
        if (councilArticles.length === 0) return null;
        const councilEl = (
          <CouncilColumn items={councilArticles.map((a) => ({
            id: a.id, slug: a.slug, title: a.title, content: a.content, author: a.author?.name ?? null, publishedAt: a.publishedAt ? formatDate(a.publishedAt) : '',
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
          ? <IndustryNews links={industry.map((l) => ({ id: l.id, title: l.title, url: l.url, source: l.source, author: l.author, views: l.views, postedAt: l.postedAt }))} />
          : null;
        // Yield to a module that pinned this poll/quiz, and never repeat one a
        // module already rendered (global de-dup).
        let pollEl: React.ReactNode = null;
        if (activePoll && !pinnedPollIds.has(activePoll.id) && !shownPollIds.has(activePoll.id)) {
          shownPollIds.add(activePoll.id);
          pollEl = <PollCard poll={{ id: activePoll.id, question: activePoll.question, closesAt: activePoll.closesAt, options: activePoll.options }} loggedIn={loggedIn} votedOptionId={priorPollVote?.optionId ?? null} />;
        }
        let quizEl: React.ReactNode = null;
        if (activeQuiz && !pinnedQuizIds.has(activeQuiz.id) && !shownQuizIds.has(activeQuiz.id)) {
          shownQuizIds.add(activeQuiz.id);
          quizEl = <QuizCard quiz={{ id: activeQuiz.id, title: activeQuiz.title, closesAt: activeQuiz.closesAt, questions: activeQuiz.questions }} loggedIn={loggedIn} initialDone={!!priorQuizResponse} />;
        }
        // Poll + Pop Quiz stack together in the narrower right-hand column.
        const asideEl = (pollEl || quizEl) ? <div className="flex flex-col gap-6">{pollEl}{quizEl}</div> : null;
        if (!indEl && !asideEl) return null; // everything here was deduped away
        if (indEl && asideEl) {
          return <div key={id} className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">{indEl}{asideEl}</div>;
        }
        return <div key={id}>{indEl ?? asideEl}</div>;
      }
      case 'comic':
        if (!currentComic) return null;
        return (
          <section key={id} className="module">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="module-title text-brand-600">Backroom Humor</h2>
              <Link href="/docs/archive/comics" className="text-sm font-semibold text-brand-600 hover:underline">View all comics</Link>
            </div>
            {/* The comic sits on a themed tile (the same nested-panel surface used
                across the app) so it reads as part of the card in light / dark / RS
                — no more foreign dark block. */}
            <div className="tile grid place-items-center p-3">
              <ComicImage src={currentComic.image} alt={currentComic.title} className="block max-h-[560px] w-auto max-w-full rounded-lg" />
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
                <ArticleLink key={a.id} slug={a.slug} data-hp-id={a.id} className="flex items-center gap-3.5 py-3 hover:opacity-90"
                  data-trk-type="article" data-trk-id={a.id} data-trk-place="trending" data-trk-props={JSON.stringify({ module: 'trending', moduleType: 'list', pos: i, hasImage: false })}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{i + 1}</span>
                  <span className="flex-1 text-lg font-extrabold leading-tight tracking-tight">{a.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-[var(--muted)]"><Eye width={14} height={14} />{a.views}</span>
                </ArticleLink>
              ))}
            </div>
          </section>
        );
      case 'rediscover':
        if (rediscover.length === 0) return null;
        return (
          <section key={id} className="module">
            <div className="mb-4">
              <h2 className="module-title">Rediscover</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Older stories worth another look — refreshed daily.</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {rediscover.map((a, i) => (
                <div key={a.id} data-hp-id={a.id} className="group relative">
                  <div className="absolute right-0 top-4 z-10"><SaveButtons item={{ id: a.id, title: a.title, slug: a.slug }} /></div>
                  <AdminArticleEdit id={a.id} pos="right-[88px] top-4" />
                  <ArticleLink slug={a.slug} className="block py-4"
                    data-trk-type="article" data-trk-id={a.id} data-trk-place="rediscover" data-trk-props={JSON.stringify({ module: 'rediscover', moduleType: 'list', pos: i, hasImage: false })}>
                    {a.category && <span className="cat-ink text-xs font-bold" style={{ '--c': a.category.color } as React.CSSProperties}>{a.category.name}</span>}
                    <h3 className="mt-1 pr-[76px] text-[22px] font-extrabold leading-tight tracking-tight group-hover:text-brand-600">{a.title}</h3>
                    <div className="mt-2 flex items-center gap-3.5 text-xs text-[var(--muted)]">
                      <span>{formatDate(a.publishedAt)}</span>
                      <span className="flex items-center gap-1"><Clock width={13} height={13} />{a.readMinutes} min</span>
                    </div>
                  </ArticleLink>
                </div>
              ))}
            </div>
          </section>
        );
      case 'sponsored': {
        // Featured (paid) placements. Show an active sponsor only once it has
        // dropped out of the top sections (hero / this week / trending) and isn't
        // already shown in a module above. Every card is the SAME fixed size —
        // the row shrinks to fit one and grows sideways as sponsors are added, so
        // no sponsor's placement changes because another bought in. Hides itself
        // when there's nothing to show.
        const items = sponsored.filter((a) => !topSectionIds.has(a.id) && !shownArticleIds.has(a.id));
        if (items.length === 0) return null;
        items.forEach((a) => shownArticleIds.add(a.id));
        return (
          <section key={id} className="module">
            <h2 className="module-title mb-4">Featured</h2>
            <div className="flex flex-wrap gap-4">
              {items.map((a, i) => (
                <div key={a.id} data-hp-id={a.id} className="w-full sm:w-[300px]">
                  <ArticleCard article={a} trk={{ place: 'featured', props: { module: 'featured', moduleType: 'grid', pos: i } }} />
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'latest': {
        // The generic "Latest" list yields any story already shown in a module
        // above it (global de-dup) so the same card never appears twice on the
        // page. Drawn from the full pool, so skipping a few still fills 7.
        const latestItems = latest.filter((a) => !shownArticleIds.has(a.id)).slice(0, 7);
        if (latestItems.length === 0) return null;
        latestItems.forEach((a) => shownArticleIds.add(a.id));
        return (
          <section key={id} className="module">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="module-title">Latest articles</h2>
              <Link href="/docs/archive" className="text-sm font-semibold text-brand-600 hover:underline">View archive</Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {latestItems.map((a, i) => (
                <div key={a.id} data-hp-id={a.id} className="group relative">
                  <div className="absolute right-0 top-4 z-10"><SaveButtons item={{ id: a.id, title: a.title, slug: a.slug }} /></div>
                  <AdminArticleEdit id={a.id} pos="right-[88px] top-4" />
                  <ArticleLink slug={a.slug} className="block py-4"
                    data-trk-type="article" data-trk-id={a.id} data-trk-place="latest" data-trk-props={JSON.stringify({ module: 'latest', moduleType: 'list', pos: i, hasImage: false })}>
                    {a.category && <span className="cat-ink text-xs font-bold" style={{ '--c': a.category.color } as React.CSSProperties}>{a.category.name}</span>}
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
      }
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
    <AdminEditProvider value={isAdmin}>
    <HomepageHighlight />
    <ScrollReveal />
    <div className="space-y-10 px-4 py-6 lg:space-y-[52px] lg:px-7 lg:py-8">
      {/* ===== Headline (Full or ⅔ — admin-controlled) ===== */}
      {lead && (
        <SectionWidth spanKey="home_hero_span" span={heroSpan} isAdmin={isAdmin}>
          <Hero lead={lead} />
        </SectionWidth>
      )}

      {/* ===== Orange "Published this week" (Full or ⅔ — admin-controlled) ===== */}
      {recent.length > 0 && (
        <SectionWidth spanKey="home_week_span" span={weekSpan} isAdmin={isAdmin}>
        <section className="module module-orange bg-brand-600 text-white">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="module-title text-white">Published this week</h2>
            <span className="text-sm font-semibold text-white/90">{recent.length} new</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((a) => (
              <div key={a.id} data-hp-id={a.id} className="owk-card group relative flex flex-col rounded-2xl border border-white/25 bg-white/[.13] p-4 transition hover:-translate-y-0.5 hover:bg-white/20">
                <div className="absolute right-3 top-3 z-10">
                  <SaveButtons item={{ id: a.id, title: a.title, slug: a.slug }} tone="onColor" />
                </div>
                <AdminArticleEdit id={a.id} pos="left-3 top-3" />
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
        </SectionWidth>
      )}

      {/* ===== Admin-arranged modules — a 3-column grid on desktop; each module
          spans 1/2/3 columns (its `span`). Collapses to a single stacked column
          below lg so mobile/tablet stay full-width and readable. For staff, the
          whole grid is wrapped so it can flip into on-page drag "Arrange" mode. ===== */}
      {!isAdmin ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:items-start lg:gap-x-6 lg:gap-y-[52px]">
          {layout.filter((m) => m.enabled).map((m) => {
            const el = renderModule(m);
            if (!el) return null;
            const spanCls = clampSpan(m.span) === 1 ? 'lg:col-span-1' : clampSpan(m.span) === 2 ? 'lg:col-span-2' : 'lg:col-span-3';
            return <div key={`m-${m.id}`} className={spanCls}>{el}</div>;
          })}
        </div>
      ) : (
        (() => {
          const moduleLabel = (mid: string): string =>
            isCustomModuleId(mid) ? (customById.get(mid)?.name ?? 'Custom module') : (MODULE_CATALOG[mid as ModuleId]?.label ?? mid);
          const arrangeItems = layout.filter((m) => m.enabled).flatMap((m) => {
            const el = renderModule(m);
            if (!el) return [];
            const isCustom = isCustomModuleId(m.id);
            const customRow = isCustom ? customById.get(m.id) : null;
            return [{
              id: m.id, span: clampSpan(m.span), locked: !!m.locked, sizeLocked: !!m.sizeLocked,
              isCustom, href: isCustom ? `/admin/studio/${m.id.slice('custom:'.length)}` : '/admin/homepage',
              editLabel: isCustom ? 'Edit this module in the Studio' : 'Manage homepage modules',
              label: moduleLabel(m.id),
              ...(customRow ? { colorTree: parseTree(customRow.tree), name: customRow.name } : {}),
              node: el,
            }];
          });
          const hiddenModules = layout.filter((m) => !m.enabled).map((m) => ({ id: m.id, label: moduleLabel(m.id) }));
          return <HomeArrangeGrid items={arrangeItems} hidden={hiddenModules} />;
        })()
      )}

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
          <Carousel>{picks.map((a, i) => <ArticleCard key={a.id} article={a} hpId={false} trk={{ place: 'picks', props: { module: 'picks', moduleType: 'carousel', pos: i } }} />)}</Carousel>
        </section>
      )}

      <div className="flex justify-center">{homeAd('leaderboard', 'home-quick')}</div>

      <section className="module">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="module-title">Quick reads</h2>
          <span className="text-sm font-semibold text-[var(--muted)]">5 min or less</span>
        </div>
        <Carousel itemWidth="w-[240px] sm:w-[260px]">{quick.map((a, i) => <ArticleCard key={a.id} article={a} compact hpId={false} trk={{ place: 'quick', props: { module: 'quick', moduleType: 'carousel', pos: i } }} />)}</Carousel>
      </section>

      <section className="module">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="module-title">More to explore</h2>
          
        </div>
        <Carousel itemWidth="w-[240px] sm:w-[260px]">{all.map((a, i) => <ArticleCard key={a.id} article={a} compact hpId={false} trk={{ place: 'more', props: { module: 'more', moduleType: 'carousel', pos: i } }} />)}</Carousel>
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
          <p className="mt-2 text-white/90">Pick your topics — Industry News, Breaking News, whatever you care about — and get them on the hub, in your inbox, or both. Anyone at your store can add their own email.</p>
          <div className="mt-4"><SubscribeLauncher label="Subscribe" className="btn bg-white text-brand-700 hover:bg-white/90" /></div>
        </div>
      </section>

      {/* Endless "Keep scrolling" feed — older stories fade in as you reach the
          bottom, until the catalog runs out. */}
      <EndlessFeed />
    </div>
    </AdminEditProvider>
  );
}

function Hero({ lead }: { lead: Card }) {
  return (
    <section data-hp-id={lead.id} className="group relative overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
      <div className="absolute right-3 top-3 z-10"><SaveButtons item={{ id: lead.id, title: lead.title, slug: lead.slug }} /></div>
      <AdminArticleEdit id={lead.id} />
      <ArticleLink slug={lead.slug} className="group grid md:grid-cols-[1.15fr_1fr]">
        <div className="relative grid min-h-[220px] place-items-center overflow-hidden bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] dark:from-[#33303a] dark:to-[#201d28] md:min-h-[380px]">
          {lead.coverVideo ? (
            <CoverVideo src={lead.coverVideo} poster={lead.coverImage} className="h-full w-full object-cover" style={lead.coverFocus ? { objectPosition: lead.coverFocus } : undefined} />
          ) : lead.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lead.coverImage} alt="" className="h-full w-full object-cover" style={lead.coverFocus ? { objectPosition: lead.coverFocus } : undefined} />
          ) : (
            <span className="select-none text-[110px] font-black tracking-tighter text-black/10 dark:text-white/10">RS</span>
          )}
        </div>
        <div className="flex flex-col justify-center p-7 sm:p-10">
          <div className="flex items-center gap-2.5">
            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200">Headline</span>
            {lead.category && <span className="cat-ink text-[13px] font-bold" style={{ '--c': lead.category.color } as React.CSSProperties}>{lead.category.name}</span>}
          </div>
          <h1 className="mt-4 text-4xl font-black leading-[1.06] tracking-[-0.03em] group-hover:text-brand-600 sm:text-[52px] xl:text-[58px]">{lead.title}</h1>
          {lead.excerpt && <p className="mt-[18px] max-w-[54ch] text-[17px] text-[var(--muted)]">{lead.excerpt}</p>}
          <div className="mt-[18px] flex items-center gap-2 text-[15px] font-extrabold text-brand-600">Read article <ArrowRight width={18} height={18} /></div>
        </div>
      </ArticleLink>
    </section>
  );
}
