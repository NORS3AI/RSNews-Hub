import Link from 'next/link';
import type { Metadata } from 'next';
import ArticleCard from '@/components/ArticleCard';
import { listArticles, listCategories } from '@/lib/articles';
import { getCurrentUser } from '@/lib/auth';
import { getRecommendationsForUser } from '@/lib/articles';

export const metadata: Metadata = {
  title: 'Home',
  description: 'The latest articles, guides and announcements from RSNews Hub.',
};

export const dynamic = 'force-dynamic';

export default async function MainPage() {
  const published = listArticles({ status: 'published', limit: 13 });
  const categories = listCategories();
  const user = await getCurrentUser();
  const recommended = user ? getRecommendationsForUser(user.id, 3) : [];

  const [featured, ...rest] = published;

  return (
    <div className="container-rs py-8 sm:py-10">
      {/* Hero */}
      <section className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-12 text-white sm:px-10 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-100">RSNews Hub</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
          News, guides and updates — all in one place.
        </h1>
        <p className="mt-4 max-w-xl text-brand-50">
          Read the latest stories, follow the topics you care about, and let smart recommendations
          surface what to read next.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/search" className="btn bg-white text-brand-700 hover:bg-brand-50">
            Search articles
          </Link>
          <Link href="/archive" className="btn border border-white/40 text-white hover:bg-white/10">
            Browse archive
          </Link>
        </div>
      </section>

      {/* Categories strip */}
      {categories.length > 0 && (
        <section className="mb-10">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`} className="chip">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {published.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          No published articles yet. Check back soon!
        </div>
      ) : (
        <>
          <section className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Latest stories</h2>
            <Link href="/archive" className="text-sm font-medium text-brand-700 hover:underline">
              View all →
            </Link>
          </section>
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured && <ArticleCard article={featured} featured />}
            {rest.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </section>
        </>
      )}

      {/* Personalised recommendations */}
      {recommended.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Recommended for you</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
