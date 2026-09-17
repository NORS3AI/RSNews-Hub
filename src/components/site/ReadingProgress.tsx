'use client';
import { useEffect, useState } from 'react';

// A slim reading-progress bar pinned to the very top of the viewport that fills as
// the reader scrolls down the article page — the same cue as the reader modal, for
// direct-link / SEO article pages. Window-scroll based; rAF-throttled.
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const denom = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(denom > 0 ? Math.min(100, Math.max(0, (window.scrollY / denom) * 100)) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px]" aria-hidden="true">
      <div className="h-full bg-brand-500 transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
    </div>
  );
}
