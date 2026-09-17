'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

// Break-glass admin bootstrap. Authorized in exactly one of two ways:
//   1. ADMIN_SETUP_TOKEN is set in the environment → the request must present a
//      matching token (reset an existing admin without shell access).
//   2. No token is set AND no ADMIN/EDITOR account exists yet → first-run claim.
// In every other case (the normal state of a live site: an admin exists, no
// token) this does nothing — the page 404s and this action refuses.
export async function bootstrapAdmin(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const envToken = (process.env.ADMIN_SETUP_TOKEN || '').trim();
  const token = ((formData.get('token') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = ((formData.get('password') as string) || '');

  if (envToken) {
    // Constant-ish check; token is a shared secret only the operator can set.
    if (!token || token !== envToken) return { error: 'Invalid setup token.' };
  } else {
    const staff = await prisma.user.count({ where: { role: { in: ['ADMIN', 'EDITOR'] } } });
    if (staff > 0) return { error: 'Setup is disabled — an admin already exists. Set ADMIN_SETUP_TOKEN on the host to reset one.' };
  }

  if (!email || !email.includes('@')) return { error: 'Enter a valid email.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    create: { email, name: 'Site Admin', passwordHash, role: 'ADMIN', status: 'ACTIVE', bio: 'The RS News Hub administrator.' },
  });
  redirect('/login?next=/admin');
}
