'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BrandLockup } from './BrandLogo';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  // Only follow an INTERNAL path after auth — never an absolute/scheme-relative
  // URL — so a crafted ?next=https://evil.example can't turn a real login into an
  // open-redirect to a phishing origin. Must start with a single "/".
  const nextRaw = params.get('next') || '/docs';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.startsWith('/\\') ? nextRaw : '/docs';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }
      router.push(next);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {/* The page surround (--bg) is dark ink in both themes, so use the white wordmark. */}
          <Link href="/docs" className="mx-auto mb-4 inline-block"><BrandLockup height={96} variant="dark" priority /></Link>
          <h1 className="text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {mode === 'login' ? 'Sign in to subscribe and get recommendations.' : 'Join to follow topics and personalize your feed.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" required minLength={2} className="input" placeholder="Jane Doe" autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={mode === 'register' ? 6 : 1}
              className="input" placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          {mode === 'register' && (
            <p className="text-center text-xs text-[var(--muted)]">
              By creating an account you agree to our{' '}
              <Link href="/docs/page/terms" className="text-brand-600 underline">Terms</Link> and{' '}
              <Link href="/docs/page/privacy" className="text-brand-600 underline">Privacy Policy</Link>.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          {mode === 'login' ? (
            <>Don&apos;t have an account? <Link href="/register" className="font-semibold text-brand-600 underline">Sign up</Link></>
          ) : (
            <>Already have an account? <Link href="/login" className="font-semibold text-brand-600 underline">Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
