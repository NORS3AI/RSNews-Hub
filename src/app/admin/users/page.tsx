import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { setUserStatus, deleteUser } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import { Plus } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusColor: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700', SUSPENDED: 'bg-amber-100 text-amber-700', BANNED: 'bg-red-100 text-red-700',
};
const roleColor: Record<string, string> = {
  ADMIN: 'bg-brand-100 text-brand-700', EDITOR: 'bg-purple-100 text-purple-700', USER: 'bg-gray-100 text-gray-600',
};

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const me = await getCurrentUser();
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status;

  const users = await prisma.user.findMany({
    where: {
      AND: [
        q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {},
        status && ['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status) ? { status } : {},
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { articles: true, subscriptions: true } } },
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users <span className="text-base font-normal text-[var(--muted)]">CRM</span></h1>
        <Link href="/admin/users/new" className="btn-primary btn-sm"><Plus width={16} height={16} /> Add user</Link>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email…" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ''} className="input max-w-[160px]">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
        <button className="btn-outline btn-sm">Filter</button>
        {(q || status) && <Link href="/admin/users" className="btn-ghost btn-sm">Clear</Link>}
      </form>

      <div className="card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[var(--bg-soft)]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-brand-600">{u.name}</Link>
                    <div className="text-xs text-[var(--muted)]">{u.email}{u.id === me?.id && ' · you'}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${roleColor[u.role]}`}>{u.role}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${statusColor[u.status]}`}>{u.status}</span></td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">{u._count.articles} articles · {u._count.subscriptions} subs</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3"><UserActions id={u.id} status={u.status} isSelf={u.id === me?.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[var(--border)] md:hidden">
          {users.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-brand-600">{u.name}</Link>
                  <div className="text-xs text-[var(--muted)]">{u.email}</div>
                </div>
                <span className={`badge shrink-0 ${statusColor[u.status]}`}>{u.status}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`badge ${roleColor[u.role]}`}>{u.role}</span>
                <span className="text-xs text-[var(--muted)]">joined {formatDate(u.createdAt)}</span>
              </div>
              <div className="mt-3"><UserActions id={u.id} status={u.status} isSelf={u.id === me?.id} /></div>
            </div>
          ))}
        </div>

        {users.length === 0 && <div className="p-8 text-center text-[var(--muted)]">No users match.</div>}
      </div>
    </div>
  );
}

function UserActions({ id, status, isSelf }: { id: string; status: string; isSelf: boolean }) {
  if (isSelf) return <Link href={`/admin/users/${id}`} className="btn-outline btn-sm">Edit</Link>;
  const actions = [] as { label: string; run: () => Promise<any>; danger?: boolean; confirm?: string }[];
  if (status !== 'ACTIVE') actions.push({ label: 'Activate', run: setUserStatus.bind(null, id, 'ACTIVE') });
  if (status !== 'SUSPENDED') actions.push({ label: 'Suspend', run: setUserStatus.bind(null, id, 'SUSPENDED') });
  if (status !== 'BANNED') actions.push({ label: 'Ban', run: setUserStatus.bind(null, id, 'BANNED'), confirm: 'Ban this user? They will be signed out and blocked from signing in.' });
  actions.push({ label: 'Delete', run: deleteUser.bind(null, id), danger: true, confirm: 'Permanently delete this user and all their data?' });
  return (
    <div className="flex items-center gap-1.5">
      <Link href={`/admin/users/${id}`} className="btn-outline btn-sm">Edit</Link>
      <ActionButtons actions={actions} />
    </div>
  );
}
