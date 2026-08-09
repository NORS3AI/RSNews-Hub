import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { notificationFeed } from '@/lib/subscriptions';
import { Bell, ExternalLink } from '@/components/icons';
import SubscribeLauncher from '@/components/site/SubscribeLauncher';
import NotificationsMarkSeen from '@/components/site/NotificationsMarkSeen';
import AccountEmails from '@/components/site/AccountEmails';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

function ago(d: Date): string {
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container-page py-10">
        <div className="module">
          <div className="mb-6 flex items-center gap-2"><Bell className="text-brand-600" /><h1 className="text-2xl font-black">Notifications</h1></div>
          <div className="tile flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[var(--muted)]">Sign in to follow topics and get notified about new articles and Industry News.</p>
            <Link href="/login?next=/docs/notifications" className="btn-primary btn-sm">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  const { items, hasTopics } = await notificationFeed(user.id, 50);

  return (
    <div className="container-page py-8 sm:py-10">
      <NotificationsMarkSeen />

      <div className="module mb-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Bell className="text-brand-600" /><h1 className="text-2xl font-black">Notifications</h1></div>
        <SubscribeLauncher label="Manage subscriptions" className="btn-primary btn-sm" />
      </div>

      {items.length > 0 ? (
        <div className="tile divide-y divide-[var(--border)] p-0">
          {items.map((it, i) => {
            const inner = (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${it.unread ? 'bg-brand-600' : 'bg-transparent'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate">{it.title}</span>
                    {it.type === 'industry' && <ExternalLink width={13} height={13} className="shrink-0 text-[var(--muted)]" />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted)]">
                    {it.type === 'industry'
                      ? <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: '#E97D3422', color: '#c96a26' }}>Industry News</span>
                      : it.type === 'testimonial'
                      ? <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: '#E97D3422', color: '#c96a26' }}>Testimonial</span>
                      : it.categoryName && <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `${it.categoryColor}22`, color: it.categoryColor }}>{it.categoryName}</span>}
                    <span>{it.meta || ago(it.date)}</span>
                    {it.meta && <span>· {ago(it.date)}</span>}
                  </div>
                </div>
              </div>
            );
            return it.type === 'industry'
              ? <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" className="block hover:bg-[var(--surface-2)]">{inner}</a>
              : <Link key={i} href={it.href} className="block hover:bg-[var(--surface-2)]">{inner}</Link>;
          })}
        </div>
      ) : !hasTopics ? (
        <div className="tile p-8 text-center">
          <Bell width={30} height={30} className="mx-auto mb-3 text-[var(--muted)]" />
          <p className="mb-1 text-lg font-bold">You&apos;re not following anything yet</p>
          <p className="mx-auto mb-4 max-w-sm text-sm text-[var(--muted)]">Pick the topics you care about — Industry News, Breaking News, whatever matters — and new posts show up right here.</p>
          <SubscribeLauncher label="Choose topics" className="btn-primary" />
        </div>
      ) : (
        <div className="tile p-8 text-center text-[var(--muted)]">Nothing new in your topics yet. We&apos;ll drop it here the moment there is.</div>
      )}
      </div>

      <AccountEmails />
    </div>
  );
}
