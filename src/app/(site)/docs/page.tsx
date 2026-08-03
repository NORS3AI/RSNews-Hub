import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionUser, getReaderSessionId } from '@/lib/auth';
import { getPersonalizedFeed, trendingArticles, type ArticleCard as Card } from '@/lib/recommend';
import ArticleCard from '@/components/ArticleCard';
import SearchBar from '@/components/SearchBar';
import { Sparkles, ArrowRight } from '@/components/icons';
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
  const [featuredRaw, latestRaw, categories] = await Promise.all([
    prisma.article.findMany({ where: { status: 'PUBLISHED', featured: true }, orderBy: { publishedAt: 'desc' }, take: 1, select: cardSelect }),
    prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 9, select: cardSelect }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } } }),
  ]);

  const user = await getSessionUser();
  const sessionId = getReaderSessionId();
  const feed = await getPersonalizedFeed({ userId: user?.id, sessionId, limit: 3 });

  const hero = featuredRaw[0] ? toCard(featuredRaw[0]) : (latestRaw[0] ? toCard(latestRaw[0]) : null);
  const latest = latestRaw.map(toCard).filter((a) => a.id !== hero?.id);

  return (
    <div className="container-page py-8 sm:py-10">
      {/* Hero */}
      {hero && (
        <section className="mb-10">
          <Link href={`/docs/article/${hero.slug}`} className="card group grid gap-0 overflow-hidden md:grid-cols-2">
            <div className="relative min-h-[200px] bg-gradient-to-br from-brand-500 to-brand-800 md:min-h-[320px]">
              {hero.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center p-8 text-white/90"><Sparkles width={56} height={56} /></div>
              )}
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">Featured</span>
                {hero.category && <span className="text-xs text-[var(--muted)]">{hero.category.name}</span>}
              </div>
              <h1 className="text-2xl font-bold leading-tight group-hover:text-brand-600 sm:text-3xl">{hero.title}</h1>
              {hero.excerpt && <p className="mt-3 text-[var(--muted)]">{hero.excerpt}</p>}
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-600">
                Read article <ArrowRight width={16} height={16} />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Mobile search prominence */}
      <div className="mb-8 lg:hidden"><SearchBar big /></div>

      {/* Recommended for you */}
      {feed.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles width={18} height={18} className="text-brand-600" />
            <h2 className="text-lg font-bold">{user ? 'Recommended for you' : 'You might like'}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        </section>
      )}

      {/* Categories strip */}
      {categories.length > 0 && (
        <section className="mb-10">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.id} href={`/docs/category/${c.slug}`}
                className="badge border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--bg-soft)]"
                style={{ color: c.color }}>
                {c.name} <span className="ml-1.5 text-[var(--muted)]">{c._count.articles}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Latest articles</h2>
          <Link href="/docs/archive" className="text-sm text-brand-600 hover:underline">View archive</Link>
        </div>
        {latest.length === 0 ? (
          <p className="text-[var(--muted)]">No articles published yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </section>
    </div>
  );
}
