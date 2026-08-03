import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guards';
import { getUserById } from '@/lib/users';
import { updateUserAction } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const user = getUserById(Number(id));
  if (!user) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-900">
          ← Users
        </Link>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Edit user</h1>
      </div>

      <form action={updateUserAction} className="card max-w-xl space-y-4 p-6">
        <input type="hidden" name="id" value={user.id} />
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input className="input" id="name" name="name" defaultValue={user.name} required />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" defaultValue={user.email} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="role">
              Role
            </label>
            <select className="input" id="role" name="role" defaultValue={user.role}>
              <option value="user">User</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select className="input" id="status" name="status" defaultValue={user.status}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="password">
            Reset password
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="text"
            placeholder="Leave blank to keep current password"
          />
        </div>
        <button className="btn-primary">Save changes</button>
      </form>
    </div>
  );
}
