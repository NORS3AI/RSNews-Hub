import { restoreArticleRevision } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import { Clock } from '@/components/icons';

type Rev = { id: string; title: string; createdAt: Date; authorName: string | null };

function timeAgo(d: Date): string {
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd} day${dd === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Revision history for an article: each meaningful save snapshots the prior
// version here. Restoring rolls the body back (snapshotting the current version
// first, so a restore is itself undoable).
export default function ArticleRevisions({ revisions }: { revisions: Rev[] }) {
  return (
    <div className="mt-8 card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Clock width={18} height={18} className="text-brand-600" /> Revision history</h2>
      {revisions.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No past versions yet. Each time you save a change to the body, the previous version is kept here so you can roll back.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--muted)]">The last {revisions.length} saved version{revisions.length === 1 ? '' : 's'}, newest first. Restoring keeps the current version too, so it&apos;s always reversible.</p>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  <span className="text-xs text-[var(--muted)]">{timeAgo(r.createdAt)}{r.authorName ? ` · ${r.authorName}` : ''}</span>
                </span>
                <ActionButtons actions={[{ label: 'Restore', run: restoreArticleRevision.bind(null, r.id), confirm: 'Restore this version? The current version is kept in history so you can undo.' }]} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
