'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureArticlePreviewLink, resolveArticleReview, deleteArticleReview } from '@/lib/actions';
import { formatDate } from '@/lib/utils';
import { Check, X } from '@/components/icons';

type Review = { id: string; firstName: string; lastName: string; decision: string; message: string; resolved: boolean; createdAt: Date | string };

// Admin panel under the article editor: copy the private preview link to send to
// reviewers, and see everyone's aggregated Approve / Request-changes responses.
// An unresolved change request holds the article in "Changes requested".
export default function ArticleReviews({ articleId, slug, previewToken, reviews }: { articleId: string; slug: string; previewToken: string | null; reviews: Review[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const openChanges = reviews.some((r) => r.decision === 'change' && !r.resolved);
  const status = openChanges ? 'changes' : reviews.some((r) => r.decision === 'approve') ? 'approved' : 'none';
  const approvals = reviews.filter((r) => r.decision === 'approve').length;

  async function copyLink() {
    setBusy(true);
    try {
      const token = previewToken || (await ensureArticlePreviewLink(articleId));
      const url = `${window.location.origin}/docs/article/${slug}?preview=${token}`;
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked */ }
      setCopied(true); setTimeout(() => setCopied(false), 2500);
      if (!previewToken) router.refresh(); // first-time token now exists
    } finally { setBusy(false); }
  }
  async function run(fn: () => Promise<void>) { setBusy(true); try { await fn(); router.refresh(); } finally { setBusy(false); } }

  return (
    <div className="card mt-6 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Preview &amp; approvals</h2>
        <span className={`badge ${status === 'changes' ? 'bg-amber-100 text-amber-800' : status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-[var(--card-2)] text-[var(--muted)]'}`}>
          {status === 'changes' ? '✎ Changes requested' : status === 'approved' ? `✓ Approved (${approvals})` : 'Awaiting review'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copyLink} disabled={busy} className="btn-outline btn-sm">{copied ? <><Check width={15} height={15} /> Link copied</> : 'Copy preview link'}</button>
        <span className="text-xs text-[var(--muted)]">A private link to this draft as a reader sees it. Anyone with it can view + leave a named approval or change request.</span>
      </div>

      {reviews.length > 0 && (
        <div className="mt-4 space-y-2">
          {reviews.map((r) => {
            const change = r.decision === 'change';
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${change && !r.resolved ? 'border-amber-300 bg-amber-50/60' : 'border-[var(--border)]'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${change ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>{change ? '✎ Change' : '✓ Approved'}</span>
                  <span className="font-semibold">{r.firstName} {r.lastName}</span>
                  <span className="text-xs text-[var(--muted)]">{formatDate(r.createdAt)}</span>
                  {change && r.resolved && <span className="badge bg-[var(--card-2)] text-[var(--muted)]">resolved</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {change && !r.resolved && <button onClick={() => run(() => resolveArticleReview(r.id))} disabled={busy} className="btn-ghost btn-sm">Mark resolved</button>}
                    <button onClick={() => run(() => deleteArticleReview(r.id))} disabled={busy} aria-label="Delete review" className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:text-red-600"><X width={14} height={14} /></button>
                  </span>
                </div>
                {change && r.message && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--fg)]">{r.message}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
