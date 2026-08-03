import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import type { User } from './types';

/** Require a signed-in staff member (admin or editor); redirect otherwise. */
export async function requireStaff(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'editor') redirect('/main');
  return user;
}

/** Require a signed-in admin; redirect otherwise. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/admin');
  return user;
}
