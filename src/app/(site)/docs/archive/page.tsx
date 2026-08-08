import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Archive, Newspaper, ArrowRight, BarChart } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Archive' };

export default async function ArchivePage() {
  // Archive includes both PUBLISHED and explicitly ARCHIVED articles, chronologically.
  const articles = await prisma.article.findMany({
    where: { OR: [{ status: 'ARCHIVED' }, { status: 'PUBLISHED', publishedAt: { lte: new Date() } }] },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, title: true, slug: true, publishedAt: true, createdAt: true, status: true, category: { select: { name: true, color: true } } },
  });

  const groups = new Map<string, typeof articles>();
  for (const a of articles) {
    const d = a.publishedAt ?? a.createdAt;
    const key = new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="module">
      <div className="mb-8 flex items-center gap-2"><Archive className="text-brand-600" /><h1 className="text-2xl font-bold">Archive</h1></div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
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
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-xl">😄</span>
            <span>
              <span className="block font-extrabold">Backroom Humor</span>
              <span className="block text-sm text-[var(--muted)]">Every comic we&apos;ve run.</span>
            </span>
          </span>
          <ArrowRight className="shrink-0 text-brand-600" />
        </Link>
      </div>

      {groups.size === 0 && <p className="text-[var(--muted)]">Nothing archived yet.</p>}
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
      </div>
    </div>
  );
}
