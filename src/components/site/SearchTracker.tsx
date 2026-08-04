'use client';
import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

// Fires one `search` event per results view, flagging zero-result queries (a
// key content-gap signal).
export default function SearchTracker({ q, count }: { q: string; count: number }) {
  useEffect(() => {
    if (!q) return;
    track({ type: 'search', subjectType: 'search', subjectId: q.slice(0, 120), pageType: 'search', value: count,
      props: { query: q.slice(0, 120), results: count, zeroResults: count === 0 } });
  }, [q, count]);
  return null;
}
