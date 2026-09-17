'use client';
import { useActionState } from 'react';

type Action = (prev: unknown, formData: FormData) => Promise<{ error?: string }>;

export default function SetupForm({ requireToken, action }: { requireToken: boolean; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-6 space-y-3">
      {requireToken && (
        <div>
          <label className="label" htmlFor="token">Setup token</label>
          <input id="token" name="token" type="password" required className="input" placeholder="ADMIN_SETUP_TOKEN value" autoComplete="off" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Admin email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={6} className="input" placeholder="At least 6 characters" autoComplete="new-password" />
      </div>
      {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? 'Setting up…' : 'Set admin & continue'}</button>
    </form>
  );
}
