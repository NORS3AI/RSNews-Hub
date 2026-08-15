'use client';
import { createContext, useContext, useRef, useState } from 'react';

// Shared recommend state for ONE article so the top-of-article count and the
// end-of-article button never diverge within a session: both read/write the same
// count + toggled flag. Seeded from server props; in the modal it's keyed by
// article id so navigating between articles remounts it with fresh state.

type RecommendCtx = { articleId: string; count: number; on: boolean; busy: boolean; toggle: () => void };
const Ctx = createContext<RecommendCtx | null>(null);

export function useRecommend(): RecommendCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRecommend must be used within RecommendProvider');
  return c;
}

export function RecommendProvider({
  articleId, initialCount, initialOn, children,
}: { articleId: string; initialCount: number; initialOn: boolean; children: React.ReactNode }) {
  const [count, setCount] = useState(Math.max(0, initialCount));
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);
  // Synchronous latch: guards against two clicks firing in the same task before
  // React re-renders `busy` (the state guard alone can miss a synchronous pair).
  const busyRef = useRef(false);

  const toggle = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const nextOn = !on;
    // Optimistic flip; reconciled with the server's authoritative numbers below.
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
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <Ctx.Provider value={{ articleId, count, on, busy, toggle }}>{children}</Ctx.Provider>;
}
