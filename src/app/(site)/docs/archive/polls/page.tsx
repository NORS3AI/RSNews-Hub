import Link from 'next/link';
import { prisma } from '@/lib/db';
import { BarChart, ArrowLeft } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Polls archive' };

export default async function PollsArchive() {
  const polls = await prisma.poll.findMany({
    orderBy: { createdAt: 'desc' },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/archive" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Archive</Link>
      <div className="mb-8 flex items-center gap-2"><BarChart className="text-brand-600" /><h1 className="text-2xl font-bold">Polls</h1></div>
      {polls.length === 0 && <p className="text-[var(--muted)]">No polls yet.</p>}

      <div className="space-y-5">
        {polls.map((poll) => {
          const total = poll.options.reduce((n, o) => n + o.votes, 0);
          const closed = !!poll.closesAt && poll.closesAt < new Date();
          return (
            <section key={poll.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-lg font-extrabold leading-snug">{poll.question}</h2>
                {poll.active ? <span className="badge shrink-0 bg-green-100 text-green-700">Live</span>
                  : closed ? <span className="badge shrink-0 bg-amber-100 text-amber-700">Closed</span>
                  : <span className="badge shrink-0 bg-[var(--bg-soft)] text-[var(--muted)]">Past</span>}
              </div>
              <div className="space-y-2">
                {poll.options.map((o) => {
                  const pct = total ? Math.round((o.votes / total) * 100) : 0;
                  return (
                    <div key={o.id} className="relative overflow-hidden rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                      <div className="absolute inset-y-0 left-0 bg-brand-600/15" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between gap-2">
                        <span className="font-bold">{o.label}</span>
                        <span className="shrink-0 text-sm font-extrabold text-brand-700 dark:text-brand-300">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">{total.toLocaleString()} total vote{total === 1 ? '' : 's'}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
