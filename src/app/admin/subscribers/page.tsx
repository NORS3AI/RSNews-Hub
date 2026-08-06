import { prisma } from '@/lib/db';
import { newsletterStatus } from '@/lib/newsletter';
import NewsletterAdmin from '@/components/admin/NewsletterAdmin';

export const dynamic = 'force-dynamic';

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';
}

export default async function AdminSubscribers() {
  const [status, subs] = await Promise.all([
    newsletterStatus(),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Subscribers</h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        People signed up for the daily <strong>Industry News</strong> digest — one email a day, only when there&apos;s something new. Anyone can subscribe from the homepage with just an email (no account needed), so managers and staff can get it too.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Daily digest</h2>
              <span className={`badge ${status.emailReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                {status.emailReady ? 'SendGrid connected' : 'Email: log-only'}
              </span>
            </div>
            <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[var(--muted)]">Active</dt><dd className="text-2xl font-bold">{status.active}</dd></div>
              <div><dt className="text-[var(--muted)]">Pending items</dt><dd className="text-2xl font-bold">{status.pending}</dd></div>
              <div className="col-span-2"><dt className="text-[var(--muted)]">Last sent</dt><dd className="font-semibold">{fmt(status.lastSentAt)}</dd></div>
            </dl>
            <NewsletterAdmin emailReady={status.emailReady} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{status.total} subscriber{status.total === 1 ? '' : 's'}</div>
            {subs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--muted)]">No subscribers yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 truncate font-medium">{s.email}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted)]">
                      <span>{fmt(s.createdAt)}</span>
                      {!s.active && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">unsubscribed</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
