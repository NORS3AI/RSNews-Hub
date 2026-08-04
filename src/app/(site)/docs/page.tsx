import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { getPersonalizedFeed, trendingArticles, type ArticleCard as Card } from '@/lib/recommend';
import { getHomeLayout, type ModuleId } from '@/lib/homepage';
import ArticleCard from '@/components/ArticleCard';
import AdSlot from '@/components/AdSlot';
import ArticleLink from '@/components/site/ArticleLink';
import SaveButtons from '@/components/site/StarButton';
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
    prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 20, select: cardSelect }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } } }),
    getHomeLayout(),
  ]);

  const user = await getSessionUser();
  const sessionId = getReaderSessionId();
  const [feed, trending] = await Promise.all([
    getPersonalizedFeed({ userId: user?.id, sessionId, limit: 3 }),
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
            <div className="mb-4"><h2 className="module-title">{user ? 'Recommended for you' : 'You might like'}</h2></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{feed.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
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
                  <span className="line-clamp-2 flex-1 font-bold leading-tight">{a.title}</span>
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
                    <h3 className="mt-1 line-clamp-2 pr-[76px] text-lg font-bold leading-snug group-hover:text-brand-600">{a.title}</h3>
                    {a.excerpt && <p className="mt-1.5 line-clamp-1 text-sm text-[var(--muted)]">{a.excerpt}</p>}
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

  return (
    <div className="space-y-5 px-4 py-6 lg:px-7 lg:py-7">
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
                  <h3 className="mt-1.5 line-clamp-3 pr-[76px] text-[17px] font-extrabold leading-snug">{a.title}</h3>
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
          <h1 className="mt-3.5 text-3xl font-black leading-[1.12] tracking-tight group-hover:text-brand-600 sm:text-[40px]">{lead.title}</h1>
          {lead.excerpt && <p className="mt-4 max-w-[52ch] text-base text-[var(--muted)]">{lead.excerpt}</p>}
          <div className="mt-[18px] flex items-center gap-2 text-[15px] font-extrabold text-brand-600">Read article <ArrowRight width={18} height={18} /></div>
        </div>
      </ArticleLink>
    </section>
  );
}
