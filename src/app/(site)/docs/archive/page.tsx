import Link from 'next/link';
import { getArchiveData } from '@/lib/archiveData';
import { Archive, Newspaper, ArrowRight, BarChart, Check, ThumbsUp, Clock, Smile } from '@/components/icons';
import { formatDate, classNames } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Archive' };

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort, articles, groups } = await getArchiveData((await searchParams).sort);
  const tab = (href: string, label: string, active: boolean, Icon: typeof Clock) => (
    <Link href={href} className={classNames('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
      active ? 'border-brand-500 bg-brand-500 text-white' : 'border-[var(--border)] text-[var(--muted)] hover:border-brand-400 hover:text-[var(--fg)]')}>
      <Icon width={15} height={15} />{label}
    </Link>
  );

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="module">
      <div className="mb-8 flex items-center gap-2"><Archive className="text-brand-600" /><h1 className="text-2xl font-bold">Archive</h1></div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/docs/archive/industry" className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-5 shadow-[var(--shadow-card)] transition hover:border-brand-400">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Newspaper width={22} height={22} /></span>
            <span>
              <span className="block font-extrabold">Industry News archive</span>
              <span className="block text-sm text-[var(--muted)]">Every curated external link we&apos;ve posted.</span>
            </span>
          </span>
          <ArrowRight className="shrink-0 text-brand-600" />
        </Link>
        <Link href="/docs/archive/polls" className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-5 shadow-[var(--shadow-card)] transition hover:border-brand-400">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><BarChart width={22} height={22} /></span>
            <span>
              <span className="block font-extrabold">Polls archive</span>
              <span className="block text-sm text-[var(--muted)]">Past reader polls and their results.</span>
            </span>
          </span>
          <ArrowRight className="shrink-0 text-brand-600" />
        </Link>
        <Link href="/docs/archive/comics" className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-5 shadow-[var(--shadow-card)] transition hover:border-brand-400">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Smile width={22} height={22} /></span>
            <span>
              <span className="block font-extrabold">Backroom Humor</span>
              <span className="block text-sm text-[var(--muted)]">Every comic we&apos;ve run.</span>
            </span>
          </span>
          <ArrowRight className="shrink-0 text-brand-600" />
        </Link>
        <Link href="/docs/archive/quizzes" className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-5 shadow-[var(--shadow-card)] transition hover:border-brand-400">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Check width={22} height={22} /></span>
            <span>
              <span className="block font-extrabold">Pop Quiz archive</span>
              <span className="block text-sm text-[var(--muted)]">Past quizzes and how many played.</span>
            </span>
          </span>
          <ArrowRight className="shrink-0 text-brand-600" />
        </Link>
      </div>

      {/* Sort the article archive: chronological, or ranked by reader recommends. */}
      <div className="mb-5 flex items-center gap-2">
        {tab('/docs/archive', 'Newest', sort === 'newest', Clock)}
        {tab('/docs/archive?sort=recommended', 'Most recommended', sort === 'recommended', ThumbsUp)}
      </div>

      {articles.length === 0 && (
        <p className="text-[var(--muted)]">{sort === 'recommended' ? 'No recommended articles yet — readers haven’t weighed in.' : 'Nothing archived yet.'}</p>
      )}

      {sort === 'recommended' && articles.length === 100 && (
        <p className="mb-3 text-xs text-[var(--muted)]">Showing the top 100 most-recommended articles.</p>
      )}
      {sort === 'recommended' ? (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-2)] shadow-[var(--shadow-card)]">
          {articles.map((a, i) => (
            <li key={a.id}>
              <Link href={`/docs/article/${a.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--bg-soft)]">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-sm font-black tabular-nums text-[var(--muted)]">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{a.title}</span>
                    {a.status === 'ARCHIVED' && <span className="ml-2 text-xs text-amber-600">archived</span>}
                  </span>
                </span>
                {a.category && <span className="cat-ink hidden shrink-0 text-xs sm:inline" style={{ '--c': a.category.color } as React.CSSProperties}>{a.category.name}</span>}
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-brand-600"><ThumbsUp width={14} height={14} />{a.recommends}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{month}</h2>
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-2)] shadow-[var(--shadow-card)]">
                {items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/docs/article/${a.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--bg-soft)]">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{a.title}</span>
                        {a.status === 'ARCHIVED' && <span className="ml-2 text-xs text-amber-600">archived</span>}
                      </span>
                      {a.category && <span className="cat-ink hidden shrink-0 text-xs sm:inline" style={{ '--c': a.category.color } as React.CSSProperties}>{a.category.name}</span>}
                      <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(a.publishedAt ?? a.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
