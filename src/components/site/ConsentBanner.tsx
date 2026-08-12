'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// First-visit cookie/analytics notice. We use first-party analytics only, so the
// model is notice + opt-out: the banner shows once, the choice is remembered in
// localStorage ('rsnews_consent' = 'accepted' | 'declined'), and lib/analytics
// stops collecting when the reader declines. Signed-in state / preferences are
// essential and unaffected either way.
const KEY = 'rsnews_consent';

export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true); } catch { /* private mode: don't nag */ }
  }, []);

  function choose(value: 'accepted' | 'declined') {
    try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;
  return (
    <div role="dialog" aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-[var(--fg)]">
          We use cookies to keep you signed in and to understand what readers find useful. See our{' '}
          <Link href="/docs/page/privacy" className="font-semibold text-brand-600 hover:underline">Privacy Policy</Link>.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => choose('declined')}
            className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-sm font-semibold text-[var(--fg)] transition hover:bg-[var(--bg-soft)]">
            Decline
          </button>
          <button type="button" onClick={() => choose('accepted')}
            className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-brand-700">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
