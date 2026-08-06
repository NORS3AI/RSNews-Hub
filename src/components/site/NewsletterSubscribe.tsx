'use client';
import { useState } from 'react';

/** Open email capture for the daily Industry News digest — anyone can sign up. */
export default function NewsletterSubscribe() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'busy' || state === 'done') return;
    setState('busy'); setMsg('');
    try {
      const res = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.ok) { setState('done'); setMsg("You're on the list — the daily digest lands in your inbox."); }
      else { setState('err'); setMsg(data.error || 'Something went wrong.'); }
    } catch {
      setState('err'); setMsg('Something went wrong — try again.');
    }
  }

  if (state === 'done') {
    return <p className="mt-4 rounded-xl bg-white/15 px-4 py-3 font-semibold text-white">✓ {msg}</p>;
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2.5">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email"
        className="h-[46px] min-w-[220px] flex-1 rounded-xl border border-white/40 bg-white/15 px-3.5 text-white placeholder:text-white/60 outline-none focus:border-white" />
      <button disabled={state === 'busy'} className="btn bg-white text-brand-700 hover:bg-white/90 disabled:opacity-70">{state === 'busy' ? 'Subscribing…' : 'Subscribe'}</button>
      {state === 'err' && <p className="w-full text-sm text-white/90">{msg}</p>}
    </form>
  );
}
