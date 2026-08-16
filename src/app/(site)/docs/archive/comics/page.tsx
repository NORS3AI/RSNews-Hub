import Link from 'next/link';
import { getComicsArchiveData } from '@/lib/archiveData';
import { ArrowLeft } from '@/components/icons';
import { postedLabel } from '@/lib/industry';
import ComicImage from '@/components/site/ComicImage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backroom Humor — comics' };

export default async function ComicsArchive() {
  const comics = await getComicsArchiveData();

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/archive" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Archive</Link>
      <div className="mb-2 flex items-center gap-2"><span className="text-2xl">😄</span><h1 className="text-2xl font-bold">Backroom Humor</h1></div>
      <p className="mb-8 text-[var(--muted)]">Every comic we&apos;ve run.</p>
      {comics.length === 0 && <p className="text-[var(--muted)]">No comics yet.</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {comics.map((c) => (
          <figure key={c.id} className="card overflow-hidden p-3">
            <ComicImage src={c.image} alt={c.title} className="w-full rounded-lg" />
            <figcaption className="px-1 pb-1 pt-3">
              <span className="block font-extrabold leading-snug">{c.title}</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">{postedLabel(c.postedAt)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
