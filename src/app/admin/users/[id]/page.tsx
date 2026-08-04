import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { updateUser } from '@/lib/actions';
import { ROLES, USER_STATUSES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function EditUser(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [user, me] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { articles: true, subscriptions: true, readingLogs: true } },
        subscriptions: { include: { category: true } },
      },
    }),
    getCurrentUser(),
  ]);
  if (!user) notFound();
  const isSelf = me?.id === user.id;

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <Link href="/admin/users" className="btn-outline btn-sm">Back to users</Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-2xl font-bold">{user._count.articles}</div><div className="text-xs text-[var(--muted)]">Articles authored</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{user._count.subscriptions}</div><div className="text-xs text-[var(--muted)]">Subscriptions</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{user._count.readingLogs}</div><div className="text-xs text-[var(--muted)]">Articles read</div></div>
      </div>

      <form action={updateUser} className="card space-y-4 p-6">
        <input type="hidden" name="id" value={user.id} />
        {isSelf && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">This is your own account. You can&apos;t change your own role or status.</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required defaultValue={user.name} className="input" /></div>
          <div><label className="label">Email</label><input value={user.email} disabled className="input opacity-60" /></div>
          <div>
            <label className="label" htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue={user.role} disabled={isSelf} className="input disabled:opacity-60">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={user.status} disabled={isSelf} className="input disabled:opacity-60">
              {USER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="notes">Admin notes <span className="font-normal text-[var(--muted)]">(private)</span></label>
          <textarea id="notes" name="notes" defaultValue={(user as any).notes ?? ''} className="input min-h-[70px]" placeholder="Internal notes about this user…" />
        </div>
        <div>
          <label className="label" htmlFor="password">Reset password <span className="font-normal text-[var(--muted)]">(leave blank to keep)</span></label>
          <input id="password" name="password" type="text" minLength={6} className="input" placeholder="New password" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Joined {formatDate(user.createdAt)}</span>
          <button className="btn-primary btn-sm">Save changes</button>
        </div>
      </form>

      {user.subscriptions.length > 0 && (
        <div className="card mt-6 p-6">
          <h2 className="mb-3 font-semibold">Subscriptions</h2>
          <div className="flex flex-wrap gap-2">
            {user.subscriptions.map((s) => (
              <span key={s.id} className="badge border border-[var(--border)]">{s.category?.name ?? 'All articles'}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
