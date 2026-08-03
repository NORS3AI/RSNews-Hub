import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="container-rs flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Join to subscribe to articles and unlock personalised recommendations.
        </p>

        {params.error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</div>
        )}

        <form action="/api/auth/register" method="post" className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input className="input" id="name" name="name" type="text" required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
          </div>
          <button type="submit" className="btn-primary w-full">
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
