import Link from 'next/link';
import type { Metadata } from 'next';
import { getArchive } from '@/lib/articles';

export const metadata: Metadata = { title: 'Archive' };
export const dynamic = 'force-dynamic';

export default function ArchivePage() {
  const archive = getArchive();
  const total = archive.reduce((n, g) => n + g.articles.length, 0);

  return (
    <div className="container-rs py-8">
      <h1 className="text-3xl font-black text-slate-900">Archive</h1>
      <p className="mt-1 text-slate-500">
        Every published story, grouped by month — {total} in total.
      </p>

      {archive.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-slate-500">Nothing archived yet.</div>
      ) : (
        <div className="mt-8 space-y-10">
          {archive.map((group) => (
            <section key={group.period}>
              <h2 className="mb-3 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">
                {group.period}
              </h2>
              <ul className="divide-y divide-slate-100">
                {group.articles.map((a) => (
                  <li key={a.id} className="py-3">
                    <Link
                      href={`/articles/${a.slug}`}
                      className="group flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-800 group-hover:text-brand-700">
                        {a.title}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-slate-400">
                        {a.category_name && (
                          <span className="badge bg-brand-50 text-brand-700">{a.category_name}</span>
                        )}
                        {a.published_at &&
                          new Date(a.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
