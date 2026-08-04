'use client';
import { useSaved } from './StarProvider';
import { useArticleModal } from './ArticleModalProvider';
import { Clock } from '@/components/icons';

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HistoryList() {
  const { history, clearHistory, ready } = useSaved();
  const { openArticle } = useArticleModal();

  return (
    <div className="module">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Clock className="text-brand-600" width={20} height={20} /> Your history</h1>
        {ready && history.length > 0 && (
          <button onClick={clearHistory} className="btn-outline btn-sm">Clear history</button>
        )}
      </div>

      {!ready ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-[var(--muted)]">
          No history yet. Open a few articles and they&apos;ll show up here — handy for finding one you clicked away from while article-hopping.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">The last {history.length} article{history.length === 1 ? '' : 's'} you opened, most recent first.</p>
          <ul className="divide-y divide-[var(--border)]">
            {history.map((h) => (
              <li key={h.id}>
                <button onClick={() => openArticle(h.slug)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-[var(--bg-soft)]">
                  <Clock width={15} height={15} className="shrink-0 text-[var(--muted)]" />
                  <span className="min-w-0 flex-1 truncate font-medium hover:text-brand-600">{h.title}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{timeAgo(h.ts)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
