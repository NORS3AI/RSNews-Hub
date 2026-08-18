import Link from 'next/link';
import { prisma } from '@/lib/db';
import { FileText, Users, Layers, Eye, Plus, Edit, Ban, Newspaper, ExternalLink, BarChart } from '@/components/icons';
import { formatDate } from '@/lib/utils';
import { getJobHealth } from '@/lib/jobHealth';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const jobs = await getJobHealth();
  const [published, drafts, trashed, users, categories, totalViews, recent, topArticles] = await Promise.all([
    prisma.article.count({ where: { status: 'PUBLISHED' } }),
    prisma.article.count({ where: { status: 'DRAFT' } }),
    prisma.article.count({ where: { status: 'TRASHED' } }),
    prisma.user.count(),
    prisma.category.count(),
    prisma.article.aggregate({ _sum: { views: true } }),
    prisma.article.findMany({ orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, title: true, slug: true, status: true, updatedAt: true, views: true } }),
    prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: { views: 'desc' }, take: 5, select: { id: true, title: true, slug: true, views: true } }),
  ]);

  // Newsroom quick actions — plain shortcuts to where the task lives. Each is
  // safe for a non-technical stand-in; the risky things (ads, newsletter blast,
  // homepage rebuild) are intentionally NOT here.
  const quickActions = [
    { label: 'Post a story', desc: 'Write it, or paste from Word in one step', href: '/admin/articles/new', icon: Plus, primary: true },
    { label: 'Correct or update a story', desc: 'Find it, edit, hit Save — it stays live in place', href: '/admin/articles', icon: Edit },
    { label: 'Pull a story', desc: 'Take a live story down in one click (Unpublish)', href: '/admin/articles?status=PUBLISHED', icon: Ban },
    { label: 'Add an industry link', desc: 'Share a quick external news link', href: '/admin/industry', icon: Newspaper },
    { label: 'Run a poll', desc: 'Start or manage a reader poll', href: '/admin/polls', icon: BarChart },
    { label: 'View the live site', desc: 'See exactly what readers see', href: '/docs', icon: ExternalLink, external: true },
  ];

  const stats = [
    { label: 'Published', value: published, icon: FileText, href: '/admin/articles?status=PUBLISHED', tip: 'Live articles readers can see right now. Click to manage them.' },
    { label: 'Drafts', value: drafts, icon: FileText, href: '/admin/articles?status=DRAFT', tip: 'Articles started but not yet published — only staff can see these.' },
    { label: 'Total views', value: totalViews._sum.views ?? 0, icon: Eye, href: '/admin/articles', tip: 'All-time article opens summed across every article. A lifetime total, not this month.' },
    { label: 'Users', value: users, icon: Users, href: '/admin/users', tip: 'Member and staff accounts that exist in the hub (created on a member’s first visit). Not your full RS News roster.' },
    { label: 'Categories', value: categories, icon: Layers, href: '/admin/categories', tip: 'Sections articles can be filed under (e.g. Industry News, What’s Hot).' },
    { label: 'In trash', value: trashed, icon: FileText, href: '/admin/articles?status=TRASHED', tip: 'Articles moved to trash. They’re hidden from readers and can be restored or permanently deleted.' },
  ];

  const statusColor: Record<string, string> = {
    PUBLISHED: 'bg-green-100 text-green-700', DRAFT: 'bg-gray-100 text-gray-600',
    ARCHIVED: 'bg-amber-100 text-amber-700', TRASHED: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/admin/articles/new" className="btn-primary btn-sm"><Plus width={16} height={16} /> New article</Link>
      </div>

      {/* Quick actions — guide whoever lands here (esp. a stand-in covering the
          newsroom) straight to the common tasks, without hunting the nav. */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((q) => (
            <Link key={q.label} href={q.href} {...(q.external ? { target: '_blank', rel: 'noopener' } : {})}
              className="group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-card transition hover:border-brand-400 hover:shadow-md">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${q.primary ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 dark:bg-brand-950/40'}`}>
                <q.icon width={18} height={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold leading-tight group-hover:text-brand-600">{q.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{q.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} title={s.tip} className="card group relative p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full border border-[var(--border)] text-[9px] font-black leading-none text-[var(--muted)] opacity-45 transition-opacity group-hover:opacity-90">i</span>
            <s.icon width={18} height={18} className="text-brand-600" />
            <div className="mt-2 text-2xl font-bold">{s.value.toLocaleString()}</div>
            <div className="text-xs text-[var(--muted)]">{s.label}</div>
            <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--fg)] px-3 py-2 text-left text-[11px] font-normal leading-snug text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
              {s.tip}
            </span>
          </Link>
        ))}
      </div>

      {/* Scheduled-job health — a stalled or never-configured cron is silent, so surface it. */}
      {(() => {
        const problems = jobs.filter((j) => j.neverRun || j.stale);
        return (
          <section className={`card mb-8 p-5 ${problems.length ? 'border-amber-300 dark:border-amber-800' : ''}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Scheduled jobs</h2>
              {problems.length > 0
                ? <span className="badge bg-amber-100 text-amber-800">{problems.length} need{problems.length === 1 ? 's' : ''} attention</span>
                : <span className="badge bg-green-100 text-green-700">All healthy</span>}
            </div>
            {problems.length > 0 && (
              <p className="mb-3 text-sm text-[var(--muted)]">A job that never runs fails silently (flights don&apos;t end, emails/newsletter don&apos;t send). Point an external scheduler at each endpoint below (auth: <code>Authorization: Bearer $CRON_SECRET</code>).</p>
            )}
            <ul className="divide-y divide-[var(--border)]">
              {jobs.map((j) => (
                <li key={j.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{j.label} <code className="ml-1 text-[11px] font-normal text-[var(--muted)]">{j.endpoint}</code></div>
                    <div className="text-xs text-[var(--muted)]">{j.detail}</div>
                  </div>
                  {j.neverRun
                    ? <span className="badge bg-red-100 text-red-700">Never run</span>
                    : j.stale
                      ? <span className="badge bg-amber-100 text-amber-800">Stale · last {formatDate(j.lastRunAt!)}</span>
                      : <span className="badge bg-green-100 text-green-700">Ran {formatDate(j.lastRunAt!)}</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Recently updated</h2>
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/articles/${a.id}`} className="line-clamp-1 text-sm font-medium hover:text-brand-600">{a.title}</Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge ${statusColor[a.status]}`}>{a.status}</span>
                  <span className="hidden text-xs text-[var(--muted)] sm:inline">{formatDate(a.updatedAt)}</span>
                </div>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-sm text-[var(--muted)]">No articles yet.</li>}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Most read</h2>
          <ul className="divide-y divide-[var(--border)]">
            {topArticles.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--bg-soft)] text-xs font-bold">{i + 1}</span>
                <Link href={`/docs/article/${a.slug}`} className="line-clamp-1 flex-1 text-sm hover:text-brand-600">{a.title}</Link>
                <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted)]"><Eye width={13} height={13} />{a.views}</span>
              </li>
            ))}
            {topArticles.length === 0 && <li className="py-2 text-sm text-[var(--muted)]">No data yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
