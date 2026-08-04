'use client';
import { useSaved } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { BookFilled, X } from '@/components/icons';

/**
 * The pinned strip at the very top shows the reader's "To read" list (saved via
 * the open-book button). Each item is a compact chip that expands on hover to
 * reveal the full title; clicking opens the reader modal.
 */
export default function StarStrip() {
  const { toRead, removeToRead, ready } = useSaved();
  const { openArticle } = useArticleModal();
  if (!ready || toRead.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
      <div>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs font-bold text-brand-600">
            <BookFilled width={14} height={14} /> <span className="hidden sm:inline">To read</span>
          </span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none">
            {toRead.map((s) => (
              <div key={s.id}
                className="group/chip flex max-w-[44px] shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 pl-1.5 pr-1 shadow-sm transition-[max-width] duration-200 ease-out hover:max-w-[280px]">
                <button onClick={() => openArticle(s.slug)} className="flex min-w-0 items-center gap-1.5" title={s.title}>
                  <BookFilled width={12} height={12} className="shrink-0 text-brand-500" />
                  <span className="truncate text-xs font-medium text-[var(--fg)] opacity-0 transition-opacity duration-150 group-hover/chip:opacity-100">
                    {s.title}
                  </span>
                </button>
                <button onClick={() => removeToRead(s.id)} aria-label="Remove from to-read"
                  className="hidden shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] group-hover/chip:block">
                  <X width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
