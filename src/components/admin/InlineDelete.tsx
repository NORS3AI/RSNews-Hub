'use client';
import { useState } from 'react';

/**
 * Two-step delete that can't be fumbled: a small trash icon that, when clicked,
 * expands into a red "Delete now" needing a second click (with a cancel).
 * `action` is a server action already bound to the row's id.
 */
export default function InlineDelete({ action, label = 'Delete' }: { action: (fd?: FormData) => void | Promise<void>; label?: string }) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <form action={action as (fd: FormData) => void | Promise<void>}>
          <button type="submit" className="text-xs font-bold text-red-600 hover:underline dark:text-red-400">Delete now</button>
        </form>
        <button type="button" onClick={() => setArmed(false)} className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">cancel</button>
      </span>
    );
  }
  return (
    <button type="button" aria-label={label} title={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setArmed(true); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
