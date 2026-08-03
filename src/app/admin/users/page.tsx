import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { requireAdmin } from '@/lib/guards';
import { listUsers } from '@/lib/users';
import {
  createUserAction,
  setUserStatusAction,
  setUserRoleAction,
  deleteUserAction,
} from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string; error?: string }>;
}) {
  const me = await requireAdmin();
  const { q, saved, error } = await searchParams;
  const users = listUsers(q);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-black text-slate-900">Users — CRM</h1>
      <p className="mb-6 text-sm text-slate-500">
        Add, edit, move (change roles), suspend, ban or remove members.
      </p>

      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Saved.</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/admin/users" method="get" className="flex gap-2">
          <input className="input py-1.5" name="q" defaultValue={q} placeholder="Search name or email…" />
          <button className="btn-secondary py-1.5">Search</button>
        </form>
      </div>

      {/* Add user */}
      <details className="card mb-6 p-5">
        <summary className="cursor-pointer font-semibold text-slate-900">＋ Add a user</summary>
        <form action={createUserAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input className="input" id="name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Temporary password
            </label>
            <input className="input" id="password" name="password" type="text" placeholder="changeme123" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="role">
                Role
              </label>
              <select className="input" id="role" name="role" defaultValue="user">
                <option value="user">User</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select className="input" id="status" name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Create user</button>
          </div>
        </form>
      </details>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    <div className="text-xs text-slate-400">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <form action={setUserRoleAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="user">user</option>
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                      </select>
                      <button className="chip">Set</button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={u.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {u.status !== 'active' && (
                        <StatusBtn id={u.id} status="active" label="Activate" tone="primary" />
                      )}
                      {u.status !== 'suspended' && (
                        <StatusBtn id={u.id} status="suspended" label="Suspend" />
                      )}
                      {u.status !== 'banned' && <StatusBtn id={u.id} status="banned" label="Ban" />}
                      <Link href={`/admin/users/${u.id}/edit`} className="chip">
                        Edit
                      </Link>
                      {u.id !== me.id && (
                        <form action={deleteUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="chip text-red-600 hover:bg-red-50">Delete</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBtn({
  id,
  status,
  label,
  tone,
}: {
  id: number;
  status: string;
  label: string;
  tone?: 'primary';
}) {
  return (
    <form action={setUserStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`chip ${tone === 'primary' ? 'bg-brand-600 text-white hover:bg-brand-700' : ''}`}>
        {label}
      </button>
    </form>
  );
}
