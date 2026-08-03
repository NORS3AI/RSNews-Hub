'use client';
import { useEffect } from 'react';

// Fires once per mount to record a read + reading-progress bar at top.
export default function ReadTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
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
  }, [articleId]);

  return (
    <div className="fixed left-0 top-0 z-50 h-0.5 w-full bg-transparent">
      <div id="reading-progress" className="h-full w-0 bg-brand-600 transition-[width] duration-150" />
    </div>
  );
}
