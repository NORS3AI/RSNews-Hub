'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import ArticleCard from '@/components/ArticleCard';
import type { ArticleCard as Card } from '@/lib/recommend';

// The homepage "Keep scrolling" feed: as the reader nears the bottom, the next
// batch of older articles fetches and fades in — the Netflix-style endless feel,
// but bounded by real content (it stops with a clear end message). Progressive
// enhancement: renders nothing until it successfully loads, so no-JS just sees
// the rest of the homepage.
export default function EndlessFeed() {
  const [items, setItems] = useState<Card[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const offset = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/home-feed?offset=${offset.current}`);
      if (!res.ok) throw new Error('feed');
      const data = await res.json() as { items: Card[]; done: boolean };
      offset.current += data.items.length;
      setItems((prev) => [...prev, ...data.items]);
      setStarted(true);
      if (data.done || data.items.length === 0) setDone(true);
    } catch {
      setDone(true); // stop trying on error — the rest of the page is unaffected
    } finally {
      setLoading(false);
    }
  }, [loading, done]);

  // Load the next batch when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(); }, { rootMargin: '500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  if (started && items.length === 0) return null; // nothing to show at all

  return (
    <section className="module">
      {items.length > 0 && <div className="mb-4"><h2 className="module-title">Keep scrolling</h2></div>}
      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <div key={`${a.id}-${i}`} className="feed-in" style={{ animationDelay: `${(i % 3) * 50}ms` }}>
              <ArticleCard article={a} compact hpId={false} trk={{ place: 'endless', props: { module: 'endless', moduleType: 'feed', pos: i } }} />
            </div>
          ))}
        </div>
      )}
      {!done && <div ref={sentinel} aria-hidden className="h-8" />}
      {loading && <p className="mt-4 text-center text-sm text-[var(--muted)]">Loading more…</p>}
      {done && items.length > 0 && (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">You’ve reached the beginning — that’s everything we’ve published.</p>
      )}
    </section>
  );
}
