import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Archive, Newspaper, ArrowRight } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Archive' };

export default async function ArchivePage() {
  // Archive includes both PUBLISHED and explicitly ARCHIVED articles, chronologically.
  const articles = await prisma.article.findMany({
    where: { status: { in: ['PUBLISHED', 'ARCHIVED'] } },
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
      <div className="mb-8 flex items-center gap-2"><Archive className="text-brand-600" /><h1 className="text-2xl font-bold">Archive</h1></div>

      <Link href="/docs/archive/industry" className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)] transition hover:border-brand-400">
        <span className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><Newspaper width={22} height={22} /></span>
          <span>
            <span className="block font-extrabold">Industry News archive</span>
            <span className="block text-sm text-[var(--muted)]">Every curated external link we&apos;ve posted.</span>
          </span>
        </span>
        <ArrowRight className="shrink-0 text-brand-600" />
      </Link>

      {groups.size === 0 && <p className="text-[var(--muted)]">Nothing archived yet.</p>}
      <div className="space-y-10">
        {[...groups.entries()].map(([month, items]) => (
          <section key={month}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{month}</h2>
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {items.map((a) => (
                <li key={a.id}>
                  <Link href={`/docs/article/${a.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--bg-soft)]">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{a.title}</span>
                      {a.status === 'ARCHIVED' && <span className="ml-2 text-xs text-amber-600">archived</span>}
                    </span>
                    {a.category && <span className="hidden shrink-0 text-xs sm:inline" style={{ color: a.category.color }}>{a.category.name}</span>}
                    <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(a.publishedAt ?? a.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
