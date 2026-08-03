'use client';
import { useStars } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { StarFilled, X } from '@/components/icons';

/**
 * The pinned strip at the very top: one small rectangular chip per starred
 * article showing the star + a truncated title. Hovering a chip expands it to
 * reveal the full title; clicking opens the reader modal.
 */
export default function StarStrip() {
  const { stars, remove, ready } = useStars();
  const { openArticle } = useArticleModal();
  if (!ready || stars.length === 0) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
      <div className="container-page">
        <div className="flex items-center gap-2 py-2">
          <span className="flex shrink-0 items-center gap-1 pr-1 text-xs font-semibold text-brand-600">
            <StarFilled width={14} height={14} /> <span className="hidden sm:inline">Starred</span>
          </span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none">
            {stars.map((s) => (
              <div key={s.id}
                className="group/chip flex max-w-[42px] shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 pl-1.5 pr-1 shadow-sm transition-[max-width] duration-200 ease-out hover:max-w-[260px]">
                <button onClick={() => openArticle(s.slug)} className="flex min-w-0 items-center gap-1.5" title={s.title}>
                  <StarFilled width={12} height={12} className="shrink-0 text-brand-500" />
                  <span className="truncate text-xs font-medium text-[var(--fg)] opacity-0 transition-opacity duration-150 group-hover/chip:opacity-100">
                    {s.title}
                  </span>
                </button>
                <button onClick={() => remove(s.id)} aria-label="Unstar"
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
