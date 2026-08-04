import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { getPersonalizedFeed, trendingArticles, type ArticleCard as Card } from '@/lib/recommend';
import { getHomeLayout, type ModuleId } from '@/lib/homepage';
import ArticleCard from '@/components/ArticleCard';
import SearchBar from '@/components/SearchBar';
import AdSlot from '@/components/AdSlot';
import ArticleLink from '@/components/site/ArticleLink';
import StarButton from '@/components/site/StarButton';
import { Sparkles, ArrowRight, Eye } from '@/components/icons';

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
    prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 15, select: cardSelect }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } } }),
    getHomeLayout(),
  ]);

  const user = await getSessionUser();
  const sessionId = getReaderSessionId();
  const [feed, trending] = await Promise.all([
    getPersonalizedFeed({ userId: user?.id, sessionId, limit: 3 }),
    trendingArticles(4),
  ]);

  // Build the fixed headline block: a lead story + two supporting stories.
  const featured = featuredRaw.map(toCard);
  const latestAll = latestRaw.map(toCard);
  const lead = featured[0] ?? latestAll[0] ?? null;
  const used = new Set(lead ? [lead.id] : []);
  const support = [...featured.slice(1), ...latestAll].filter((a) => !used.has(a.id) && (used.add(a.id), true)).slice(0, 2);
  const supportIds = new Set(support.map((a) => a.id));
  const latest = latestAll.filter((a) => a.id !== lead?.id && !supportIds.has(a.id));

  const renderModule = (id: ModuleId) => {
    switch (id) {
      case 'recommended':
        if (feed.length === 0) return null;
        return (
          <Section key={id} title={user ? 'Recommended for you' : 'You might like'} icon>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {feed.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          </Section>
        );
      case 'categories':
        if (categories.length === 0) return null;
        return (
          <section key={id} className="mb-10">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link key={c.id} href={`/docs/category/${c.slug}`}
                  className="badge card !rounded-full px-3 py-1.5 font-medium hover:shadow-card-hover" style={{ color: c.color }}>
                  {c.name} <span className="ml-1.5 text-[var(--muted)]">{c._count.articles}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      case 'trending':
        if (trending.length === 0) return null;
        return (
          <Section key={id} title="Trending">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trending.map((a, i) => (
                <div key={a.id} className="relative">
                  <span className="absolute -left-1 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white shadow">{i + 1}</span>
                  <ArticleCard article={a} compact />
                </div>
              ))}
            </div>
          </Section>
        );
      case 'latest':
        return (
          <section key={id} className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Latest articles</h2>
              <Link href="/docs/archive" className="text-sm text-brand-600 hover:underline">View archive</Link>
            </div>
            {latest.length === 0 ? (
              <p className="text-[var(--muted)]">No more articles yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latest.slice(0, 6).map((a) => <ArticleCard key={a.id} article={a} />)}
                {/* An in-grid sidebar-style rectangle keeps ads native to the flow */}
                {latest.length > 3 && (
                  <div className="hidden items-center justify-center sm:flex"><AdSlot size="rectangle" slot="home-ingrid" /></div>
                )}
                {latest.slice(6).map((a) => <ArticleCard key={a.id} article={a} />)}
              </div>
            )}
          </section>
        );
      case 'ad-leaderboard':
        return <div key={id} className="mb-12"><AdSlot size="leaderboard" slot="home-leaderboard" /></div>;
      case 'ad-rectangles':
        return (
          <div key={id} className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdSlot size="rectangle" slot="home-rect-1" />
            <AdSlot size="rectangle" slot="home-rect-2" />
            <div className="hidden lg:block"><AdSlot size="rectangle" slot="home-rect-3" /></div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container-page py-6 sm:py-8">
      {/* ===== Fixed headline block — never reordered ===== */}
      {lead && <Headline lead={lead} support={support} />}

      {/* Mobile search prominence */}
      <div className="mb-8 lg:hidden"><SearchBar big /></div>

      {/* ===== Admin-arranged modules ===== */}
      {layout.filter((m) => m.enabled).map((m) => renderModule(m.id))}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center gap-2">
        {icon && <Sparkles width={18} height={18} className="text-brand-600" />}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Headline({ lead, support }: { lead: Card; support: Card[] }) {
  return (
    <section className="mb-10">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Lead story */}
        <article className="card card-hover group relative overflow-hidden lg:col-span-2">
          <div className="absolute right-3 top-3 z-10">
            <StarButton item={{ id: lead.id, title: lead.title, slug: lead.slug }} />
          </div>
          <ArticleLink slug={lead.slug} className="grid h-full md:grid-cols-2">
            <div className="relative grid min-h-[180px] place-items-center overflow-hidden bg-gradient-to-br from-[#ece7dc] to-[#d3ccbd] dark:from-[#33303a] dark:to-[#201d28] md:min-h-[300px]">
              {lead.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lead.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="select-none text-6xl font-black tracking-tighter text-black/10 dark:text-white/10">RS</span>
              )}
            </div>
            <div className="flex flex-col justify-center p-5 sm:p-7">
              <div className="mb-3 flex items-center gap-2">
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200">Headline</span>
                {lead.category && <span className="text-xs font-medium" style={{ color: lead.category.color }}>{lead.category.name}</span>}
              </div>
              <h1 className="text-xl font-bold leading-tight group-hover:text-brand-600 sm:text-2xl">{lead.title}</h1>
              {lead.excerpt && <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">{lead.excerpt}</p>}
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-600">Read article <ArrowRight width={16} height={16} /></div>
            </div>
          </ArticleLink>
        </article>

        {/* Supporting stories */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {support.map((a) => (
            <article key={a.id} className="card card-hover group relative overflow-hidden">
              <div className="absolute right-2.5 top-2.5 z-10">
                <StarButton item={{ id: a.id, title: a.title, slug: a.slug }} />
              </div>
              <ArticleLink slug={a.slug} className="flex h-full items-stretch">
                {a.coverImage && (
                  <div className="hidden w-24 shrink-0 sm:block lg:w-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.coverImage} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  {a.category && <span className="text-xs font-medium" style={{ color: a.category.color }}>{a.category.name}</span>}
                  <h3 className="mt-1 line-clamp-3 pr-[76px] font-semibold leading-snug group-hover:text-brand-600">{a.title}</h3>
                  <span className="mt-auto flex items-center gap-1 pt-2 text-xs text-[var(--muted)]"><Eye width={12} height={12} />{a.views}</span>
                </div>
              </ArticleLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
