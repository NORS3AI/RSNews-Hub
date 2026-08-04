import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { getPersonalizedFeed, trendingArticles, type ArticleCard as Card } from '@/lib/recommend';
import { getHomeLayout, type ModuleId } from '@/lib/homepage';
import ArticleCard from '@/components/ArticleCard';
import AdSlot from '@/components/AdSlot';
import ArticleLink from '@/components/site/ArticleLink';
import SaveButtons from '@/components/site/StarButton';
import Carousel from '@/components/site/Carousel';
import { ArrowRight, Eye, Clock } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const cardSelect = {
  id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true,
  views: true, readMinutes: true,
  category: { select: { name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;
const toCard = (a: any): Card => ({ ...a, tags: (a.tags ?? []).map((t: any) => t.tag) });

export default async function DocsHome() {
  const [featuredRaw, latestRaw, categories, layout] = await Promise.all([
    prisma.article.findMany({ where: { status: 'PUBLISHED', featured: true }, orderBy: { publishedAt: 'desc' }, take: 3, select: cardSelect }),
    prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }], take: 20, select: cardSelect }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } } }),
    getHomeLayout(),
  ]);

  const user = await getSessionUser();
  const sessionId = getReaderSessionId();
  const [feed, trending] = await Promise.all([
    getPersonalizedFeed({ userId: user?.id, sessionId, limit: 12 }),
    trendingArticles(5),
  ]);

  const featured = featuredRaw.map(toCard);
  const all = latestRaw.map(toCard);
  const lead = featured[0] ?? all[0] ?? null;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = all.filter((a) => a.publishedAt && new Date(a.publishedAt).getTime() >= weekAgo).slice(0, 8);
  const latest = all.filter((a) => a.id !== lead?.id);

  const renderModule = (id: ModuleId) => {
    switch (id) {
      case 'recommended':
        if (feed.length === 0) return null;
        return (
          <section key={id} className="module">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="module-title">{user ? 'Recommended for you' : 'You might like'}</h2>
              <span className="hidden text-sm font-semibold text-[var(--muted)] sm:inline">Swipe to see more →</span>
            </div>
            <Carousel>
              {feed.map((a) => <ArticleCard key={a.id} article={a} />)}
            </Carousel>
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
                <ArticleLink key={a.id} slug={a.slug} className="flex items-center gap-3.5 py-3 hover:opacity-90">
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
              {latest.slice(0, 7).map((a) => (
                <div key={a.id} className="group relative">
                  <div className="absolute right-0 top-4 z-10"><SaveButtons item={{ id: a.id, title: a.title, slug: a.slug }} /></div>
                  <ArticleLink slug={a.slug} className="block py-4">
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
        return <div key={id} className="module flex justify-center"><AdSlot size="leaderboard" slot="home-leaderboard" /></div>;
      case 'ad-rectangles':
        return (
          <div key={id} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="module flex justify-center"><AdSlot size="rectangle" slot="home-rect-1" /></div>
            <div className="module flex justify-center"><AdSlot size="rectangle" slot="home-rect-2" /></div>
            <div className="module hidden justify-center lg:flex"><AdSlot size="rectangle" slot="home-rect-3" /></div>
          </div>
        );
      default:
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
              <div key={a.id} className="group relative flex flex-col rounded-2xl border border-white/25 bg-white/[.13] p-4 transition hover:-translate-y-0.5 hover:bg-white/20">
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
      {layout.filter((m) => m.enabled).map((m) => renderModule(m.id))}

      {/* ===== More content + interspersed ads ===== */}
      <div className="module flex justify-center"><AdSlot size="leaderboard" slot="home-mid" /></div>

      {spotlights.flatMap((s, i) => [
        <section key={s.cat.id} className="module">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="module-title" style={{ color: s.cat.color }}>In {s.cat.name}</h2>
            <Link href={`/docs/category/${s.cat.slug}`} className="text-sm font-semibold hover:underline" style={{ color: s.cat.color }}>
              See all {s.cat._count.articles}
            </Link>
          </div>
          <Carousel>{s.items.map((a) => <ArticleCard key={a.id} article={a} />)}</Carousel>
        </section>,
        i === 0 ? <div key="spotlight-ad" className="module flex justify-center"><AdSlot size="leaderboard" slot="home-spotlight" /></div> : null,
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
            <span className="hidden text-sm font-semibold text-[var(--muted)] sm:inline">Swipe to see more →</span>
          </div>
          <Carousel>{picks.map((a) => <ArticleCard key={a.id} article={a} />)}</Carousel>
        </section>
      )}

      <div className="module flex justify-center"><AdSlot size="leaderboard" slot="home-quick" /></div>

      <section className="module">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="module-title">Quick reads</h2>
          <span className="text-sm font-semibold text-[var(--muted)]">5 min or less · swipe →</span>
        </div>
        <Carousel itemWidth="w-[240px] sm:w-[260px]">{quick.map((a) => <ArticleCard key={a.id} article={a} compact />)}</Carousel>
      </section>

      <section className="module">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="module-title">More to explore</h2>
          <span className="hidden text-sm font-semibold text-[var(--muted)] sm:inline">Swipe to see more →</span>
        </div>
        <Carousel itemWidth="w-[240px] sm:w-[260px]">{all.map((a) => <ArticleCard key={a.id} article={a} compact />)}</Carousel>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="module flex justify-center"><AdSlot size="rectangle" slot="home-r1" /></div>
        <div className="module flex justify-center"><AdSlot size="rectangle" slot="home-r2" /></div>
        <div className="module hidden justify-center lg:flex"><AdSlot size="rectangle" slot="home-r3" /></div>
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
