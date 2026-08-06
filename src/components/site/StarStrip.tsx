'use client';
import { useState } from 'react';
import { useSaved } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { Pin, X, ExpandLR, CollapseLR } from '@/components/icons';

/**
 * The pinned strip at the very top shows the reader's "Pinned" list (saved via
 * the pin button). Collapsed, each item is a compact chip that expands on hover;
 * the Expand toggle (far left) opens every title at once (the row scrolls left/
 * right when there are many), and Clear all (far right) empties it — behind a
 * Yes/No confirm so it isn't a one-tap accident.
 */
export default function StarStrip() {
  const { toRead, removeToRead, clearToRead, ready } = useSaved();
  const { openArticle } = useArticleModal();
  const [expanded, setExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  if (!ready || toRead.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Expand / collapse all titles */}
        <button onClick={() => setExpanded((e) => !e)}
          title={expanded ? 'Collapse' : 'Expand — show all titles'}
          aria-label={expanded ? 'Collapse pinned list' : 'Expand pinned list'} aria-pressed={expanded}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors hover:text-brand-600">
          {expanded ? <CollapseLR width={14} height={14} /> : <ExpandLR width={14} height={14} />}
        </button>

        <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs font-bold text-brand-600">
          <Pin width={14} height={14} /> <span className="hidden sm:inline">Pinned</span>
        </span>

        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none">
          {toRead.map((s) => (
            <div key={s.id}
              className={`group/chip flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 pl-1.5 pr-1 shadow-sm transition-[max-width] duration-200 ease-out ${expanded ? 'max-w-[280px]' : 'max-w-[44px] hover:max-w-[280px]'}`}>
              <button onClick={() => openArticle(s.slug)} className="flex min-w-0 items-center gap-1.5" title={s.title}>
                <Pin width={12} height={12} className="shrink-0 text-brand-500" />
                <span className={`truncate text-xs font-medium text-[var(--fg)] transition-opacity duration-150 ${expanded ? 'opacity-100' : 'opacity-0 group-hover/chip:opacity-100'}`}>
                  {s.title}
                </span>
              </button>
              <button onClick={() => removeToRead(s.id)} aria-label="Unpin"
                className={`shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] ${expanded ? 'block' : 'hidden group-hover/chip:block'}`}>
                <X width={12} height={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Clear all — press to reveal a Yes/No confirm so it isn't accidental. */}
        <div className="shrink-0">
          {confirmClear ? (
            <span className="flex items-center gap-1 text-xs font-semibold">
              <span className="pr-0.5 text-[var(--muted)]">Clear all?</span>
              <button onClick={() => { clearToRead(); setConfirmClear(false); }}
                className="rounded-md bg-red-600 px-2 py-1 text-white hover:bg-red-700">Yes</button>
              <button onClick={() => setConfirmClear(false)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:text-[var(--fg)]">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClear(true)} title="Clear all pinned"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:text-red-600">
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
