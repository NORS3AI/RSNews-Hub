'use client';
import { useEffect } from 'react';
import { useSaved } from './site/StarProvider';
import { analyticsDeclined } from '@/lib/consent';

// Records a read + drives the reading-progress bar, and adds the article to the
// client-side history (so a directly-visited article page is findable too).
export default function ReadTracker({ articleId, title, slug }: { articleId: string; title?: string; slug?: string }) {
  const { recordHistory } = useSaved();
  useEffect(() => {
    // The reader's OWN on-device history is a convenience, not analytics we
    // collect — it stays. The /api/reading POST (server reading-log + view
    // count) is analytics, so it respects the opt-out.
    if (title && slug) recordHistory({ id: articleId, title, slug });
    const t = setTimeout(() => {
      if (analyticsDeclined()) return;
      fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
        keepalive: true,
      }).catch(() => {});
    }, 4000); // count as "read" after 4s of dwell

    function onScroll() {
      const el = document.getElementById('reading-progress');
      if (!el) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0;
      el.style.width = p + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); };
  }, [articleId, title, slug, recordHistory]);

  return (
    <div className="fixed left-0 top-0 z-50 h-0.5 w-full bg-transparent">
      <div id="reading-progress" className="h-full w-0 bg-brand-600 transition-[width] duration-150" />
    </div>
  );
}
