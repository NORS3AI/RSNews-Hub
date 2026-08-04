import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Newspaper, ExternalLink, Eye, ArrowLeft } from '@/components/icons';
import { linkSource, postedLabel } from '@/lib/industry';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Industry News archive' };

export default async function IndustryArchive() {
  const links = await prisma.industryLink.findMany({ where: { active: true }, orderBy: [{ postedAt: 'desc' }] });

  const groups = new Map<string, typeof links>();
  for (const l of links) {
    const key = new Date(l.postedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/archive" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Archive</Link>
      <div className="mb-8 flex items-center gap-2"><Newspaper className="text-brand-600" /><h1 className="text-2xl font-bold">Industry News archive</h1></div>
      {links.length === 0 && <p className="text-[var(--muted)]">No industry links yet.</p>}
      <div className="space-y-9">
        {[...groups.entries()].map(([month, items]) => (
          <section key={month}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{month}</h2>
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {items.map((l) => (
                <li key={l.id}>
                  <a href={`/api/industry/${l.id}/go`} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 px-4 py-4 hover:bg-[var(--bg-soft)]">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-soft)] text-brand-600"><ExternalLink width={17} height={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold leading-snug group-hover:text-brand-600">{l.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                        <span className="font-bold text-[var(--fg)]/70">{linkSource(l.url, l.source)}</span>
                        <span>{postedLabel(l.postedAt)}</span>
                        <span className="flex items-center gap-1"><Eye width={12} height={12} />{l.views}</span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
