import Link from 'next/link';
import type { Metadata } from 'next';
import ArticleCard from '@/components/ArticleCard';
import { listArticles, listTags } from '@/lib/articles';

export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const query = (q || '').trim();
  const tags = listTags();

  const results =
    query || tag
      ? listArticles({ status: 'published', search: query || undefined, tagSlug: tag, limit: 60 })
      : [];

  return (
    <div className="container-rs py-8">
      <h1 className="text-3xl font-black text-slate-900">Search</h1>
      <p className="mt-1 text-slate-500">Search across titles, summaries and full article text.</p>

      <form action="/search" method="get" className="mt-6 flex gap-2">
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search articles…"
          autoFocus
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-sm text-slate-400">Popular tags:</span>
          {tags.slice(0, 12).map((t) => (
            <Link
              key={t.id}
              href={`/search?tag=${t.slug}`}
              className={`chip ${tag === t.slug ? 'bg-brand-50 text-brand-700' : ''}`}
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        {query || tag ? (
          results.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-slate-500">
                {results.length} result{results.length === 1 ? '' : 's'}
                {tag ? ` tagged “${tag}”` : ''}
                {query ? ` for “${query}”` : ''}
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </>
          ) : (
            <div className="card p-10 text-center text-slate-500">
              No articles found{query ? ` for “${query}”` : ''}. Try a different term.
            </div>
          )
        ) : (
          <div className="card p-10 text-center text-slate-400">
            Start typing above to search the archive.
          </div>
        )}
      </div>
    </div>
  );
}
