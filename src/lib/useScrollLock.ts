'use client';
import { useEffect } from 'react';

// Ref-counted body scroll lock. Multiple overlays can be open at once (e.g. an
// in-article ad zoom on top of the article reader modal); a plain add/remove of
// `modal-open` lets the inner one's cleanup unlock scrolling while the outer is
// still open. Counting keeps the lock until the LAST overlay closes.
let count = 0;

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    count += 1;
    document.body.classList.add('modal-open');
    return () => {
      count = Math.max(0, count - 1);
      if (count === 0) document.body.classList.remove('modal-open');
    };
  }, [active]);
}
