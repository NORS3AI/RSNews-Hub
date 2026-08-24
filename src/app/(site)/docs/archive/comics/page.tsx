import Link from 'next/link';
import { getComicsArchiveData } from '@/lib/archiveData';
import { ArrowLeft, Smile } from '@/components/icons';
import { postedLabel } from '@/lib/industry';
import ComicImage from '@/components/site/ComicImage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comics — archive' };

export default async function ComicsArchive({ searchParams }: { searchParams: Promise<{ series?: string | string[] }> }) {
  const { series: seriesRaw } = await searchParams;
  // A repeated ?series= param arrives as an array — take the first so the
  // filter still applies instead of silently falling back to "all".
  const seriesParam = Array.isArray(seriesRaw) ? seriesRaw[0] : seriesRaw;
  const comics = await getComicsArchiveData();

  // Series present in the archive, most-used first is overkill — keep them in
  // first-seen (newest post) order so the house strips lead.
  const seriesList = Array.from(new Set(comics.map((c) => c.series)));
  const active = seriesParam && seriesList.includes(seriesParam) ? seriesParam : null;
  const shown = active ? comics.filter((c) => c.series === active) : comics;

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/archive" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Archive</Link>
      <div className="mb-2 flex items-center gap-2"><Smile width={24} height={24} className="text-brand-600" /><h1 className="text-2xl font-bold">Comics</h1></div>
      <p className="mb-6 text-[var(--muted)]">Every comic we&apos;ve run.</p>

      {/* Series filter — shown only when there's more than one series to pick. */}
      {seriesList.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link href="/docs/archive/comics" className={`tile rounded-full px-4 py-1.5 text-sm font-bold ${!active ? 'bg-brand-600 text-white' : 'hover:shadow-[var(--shadow-hover)]'}`}>All</Link>
          {seriesList.map((s) => (
            <Link key={s} href={`/docs/archive/comics?series=${encodeURIComponent(s)}`} className={`tile rounded-full px-4 py-1.5 text-sm font-bold ${active === s ? 'bg-brand-600 text-white' : 'hover:shadow-[var(--shadow-hover)]'}`}>{s}</Link>
          ))}
        </div>
      )}

      {shown.length === 0 && <p className="text-[var(--muted)]">No comics yet.</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <figure key={c.id} className="card overflow-hidden p-3">
            <ComicImage src={c.image} alt={c.title} className="w-full rounded-lg" />
            <figcaption className="px-1 pb-1 pt-3">
              <span className="block font-extrabold leading-snug">{c.title}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="badge bg-brand-600/15 text-brand-600">{c.series}</span>{postedLabel(c.postedAt)}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
