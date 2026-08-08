'use client';
import { useEffect } from 'react';

// Reads ?hl=<comma-separated article/poll/quiz ids> from the URL and rings every
// matching element (data-hp-id) in electric blue, scrolling the first into view.
// Then it strips the param from the URL so a plain refresh clears the highlight.
// Used by the admin Homepage inventory's "Show on homepage" buttons.
export default function HomepageHighlight() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hl = params.get('hl');
    if (!hl) return;
    const ids = hl.split(',').map((s) => s.trim()).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s));
    if (!ids.length) return;

    const els: HTMLElement[] = [];
    for (const id of ids) {
      document.querySelectorAll<HTMLElement>(`[data-hp-id="${id}"]`).forEach((el) => els.push(el));
    }
    els.forEach((el) => el.classList.add('hp-highlight'));
    els[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Remove the param so refreshing the page drops the highlight.
    const url = new URL(window.location.href);
    url.searchParams.delete('hl');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, []);
  return null;
}
