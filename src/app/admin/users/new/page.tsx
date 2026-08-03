import Link from 'next/link';
import { createUser } from '@/lib/actions';
import { ROLES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default function NewUser() {
  return (
    <div className="max-w-lg">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add user</h1>
        <Link href="/admin/users" className="btn-outline btn-sm">Back</Link>
      </div>
      <form action={createUser} className="card space-y-4 p-6">
        <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Temporary password</label><input id="password" name="password" type="text" required minLength={6} className="input" placeholder="Min 6 characters" /></div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="USER" className="input">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">Editors & admins can access the admin panel.</p>
        </div>
        <button className="btn-primary w-full">Create user</button>
      </form>
    </div>
  );
}
