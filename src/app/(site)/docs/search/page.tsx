import Link from 'next/link';
import { getSearchData } from '@/lib/searchData';
import ArticleCard from '@/components/ArticleCard';
import SearchBar from '@/components/SearchBar';
import SearchTracker from '@/components/site/SearchTracker';
import { Search } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

export default async function SearchPage(props0: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props0.searchParams;
  const { q, results } = await getSearchData(searchParams.q);

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6 flex items-center gap-2"><Search className="text-brand-600" /><h1 className="text-2xl font-bold">Search</h1></div>
      <div className="mb-8 max-w-2xl"><SearchBar big /></div>

      {q && (
        <p className="mb-6 text-sm text-[var(--muted)]">
          {results.length} result{results.length === 1 ? '' : 's'} for <span className="font-medium text-[var(--fg)]">“{q}”</span>
        </p>
      )}

      {q && results.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No articles matched your search.</p>
          <Link href="/docs" className="mt-3 inline-block text-sm text-brand-600 hover:underline">Browse all articles</Link>
        </div>
      )}

      {q && <SearchTracker q={q} count={results.length} />}

      {results.length > 0 && (
        <>
        <h2 className="sr-only">Search results</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((a, i) => <ArticleCard key={a.id} article={a} trk={{ place: 'search', props: { module: 'search', moduleType: 'grid', pos: i } }} />)}
        </div>
        </>
      )}

      {!q && <p className="text-[var(--muted)]">Type a query above to search across every article — titles, tags, categories and content.</p>}
    </div>
  );
}
