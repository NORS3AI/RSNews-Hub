import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { bootstrapAdmin } from './actions';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin setup', robots: { index: false, follow: false } };

// A deliberately narrow recovery page. It is only reachable when:
//   • ADMIN_SETUP_TOKEN is set on the host (operator-enabled reset), or
//   • no ADMIN/EDITOR account exists yet (first-run claim).
// Otherwise it 404s, so a live site with an admin and no token has no exposed
// setup surface.
export default async function AdminSetupPage() {
  const envToken = (process.env.ADMIN_SETUP_TOKEN || '').trim();
  const staffCount = await prisma.user.count({ where: { role: { in: ['ADMIN', 'EDITOR'] } } });
  const enabled = !!envToken || staffCount === 0;
  if (!enabled) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Admin setup</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {envToken
          ? 'Enter your host’s setup token and choose an admin email + password. This creates the admin or resets an existing one.'
          : 'No admin exists yet — claim the first admin account by choosing an email and password.'}
      </p>
      <SetupForm requireToken={!!envToken} action={bootstrapAdmin} />
      {envToken && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          For safety, remove <code>ADMIN_SETUP_TOKEN</code> from your host’s environment once you’re back in.
        </p>
      )}
    </div>
  );
}
