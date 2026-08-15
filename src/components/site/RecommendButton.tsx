'use client';
import { useState } from 'react';
import { ThumbsUp, ThumbsUpFilled } from '@/components/icons';
import { classNames } from '@/lib/utils';

/**
 * End-of-article endorsement. A reader who's scrolled this far can say the piece
 * was worth it — a higher-quality signal than a top-of-page tap. Server-backed
 * (per-reader, toggleable) via /api/recommend, with optimistic UI. Distinct from
 * Favorite/Pin (those are "save for me"; this is "I'd recommend it").
 */
export default function RecommendButton({
  articleId, initialCount, initialOn,
}: { articleId: string; initialCount: number; initialOn: boolean }) {
  const [count, setCount] = useState(Math.max(0, initialCount));
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const nextOn = !on;
    // Optimistic flip; reconciled with the server's authoritative count below.
    setOn(nextOn);
    setCount((c) => Math.max(0, c + (nextOn ? 1 : -1)));
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) { setOn(!!data.recommended); setCount(Math.max(0, data.recommends ?? 0)); }
      else { setOn(!nextOn); setCount((c) => Math.max(0, c + (nextOn ? -1 : 1))); } // revert
    } catch {
      setOn(!nextOn); setCount((c) => Math.max(0, c + (nextOn ? -1 : 1))); // revert on network error
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-8 flex flex-col items-center gap-2.5 border-t border-[var(--border)] pt-8 text-center">
      <p className="text-sm text-[var(--muted)]">Was this worth reading?</p>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={on ? 'Remove your recommendation' : 'Recommend this article'}
        className={classNames(
          'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-bold transition-colors disabled:opacity-70',
          on ? 'border-brand-500 bg-brand-500 text-white hover:bg-brand-600'
             : 'border-brand-500 text-brand-600 hover:bg-brand-500 hover:text-white',
        )}
      >
        {on ? <ThumbsUpFilled width={18} height={18} /> : <ThumbsUp width={18} height={18} />}
        {on ? 'Recommended' : 'Recommend'}
        {count > 0 && (
          <span className={classNames('ml-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums',
            on ? 'bg-white/25 text-white' : 'bg-brand-500/15 text-brand-600')}>{count}</span>
        )}
      </button>
    </div>
  );
}
