'use client';
import { useEffect } from 'react';

// Progressive enhancement: gently fade + rise homepage modules as they scroll
// into view. Content is server-rendered and fully visible without JS — this only
// adds the hidden-then-reveal state client-side, skips anything at/above the
// first-paint fold (no flash), honors reduced-motion, and has a 5s safety that
// reveals everything no matter what. Only runs where it's mounted (homepage).
export default function ScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>('main .module'));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });

    const foldish = window.innerHeight * 0.92;
    for (const el of els) {
      if (el.getBoundingClientRect().top < foldish) continue; // in view on load → leave visible
      el.classList.add('reveal-init');
      io.observe(el);
    }
    const safety = setTimeout(() => els.forEach((el) => el.classList.add('revealed')), 5000);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);

  return null;
}
