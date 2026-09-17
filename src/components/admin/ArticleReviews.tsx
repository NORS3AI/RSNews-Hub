'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureArticlePreviewLink, resolveArticleReview, deleteArticleReview } from '@/lib/actions';
import { formatDate } from '@/lib/utils';
import { Check, X, Edit } from '@/components/icons';

type Review = { id: string; firstName: string; lastName: string; decision: string; message: string; resolved: boolean; createdAt: Date | string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Open change request(s) in a small, movable browser window so the admin can keep
// them on a second screen while editing. Content is client-side (already loaded),
// escaped before injection.
function popOut(items: Review[], title: string) {
  const w = window.open('', '_blank', 'width=560,height=680,scrollbars=yes,resizable=yes');
  if (!w) { alert('Allow pop-ups for this site to open the change request in its own window.'); return; }
  const cards = items.map((r) => `
    <section style="margin:0 0 18px;padding:16px;border:1px solid #e6e2da;border-radius:12px;background:#fff">
      <div style="font-weight:800;font-size:15px">${esc(r.firstName)} ${esc(r.lastName)}</div>
      <div style="color:#8a8f98;font-size:12px;margin:2px 0 10px">Change request${r.resolved ? ' · resolved' : ''}</div>
      <div style="white-space:pre-wrap;font-size:15px;line-height:1.55">${esc(r.message) || '<em style="color:#8a8f98">(no text)</em>'}</div>
    </section>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;color:#232a36;background:#faf8f4}h1{font-size:16px;margin:0 0 16px}</style>`
    + `</head><body><h1>${esc(title)}</h1>${cards}</body></html>`);
  w.document.close();
}

// Admin panel under the article editor: copy the private preview link to send to
// reviewers, and see everyone's aggregated Approve / Request-changes responses.
// An unresolved change request holds the article in "Changes requested".
export default function ArticleReviews({ articleId, slug, previewToken, reviews }: { articleId: string; slug: string; previewToken: string | null; reviews: Review[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null); // one change request open at a time
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyText(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
    setCopiedId(id); setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  }

  const openChanges = reviews.some((r) => r.decision === 'change' && !r.resolved);
  const status = openChanges ? 'changes' : reviews.some((r) => r.decision === 'approve') ? 'approved' : 'none';
  const approvals = reviews.filter((r) => r.decision === 'approve').length;
  const changeReqs = reviews.filter((r) => r.decision === 'change');

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
        <span className={`badge inline-flex items-center gap-1 ${status === 'changes' ? 'bg-amber-100 text-amber-800' : status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-[var(--card-2)] text-[var(--muted)]'}`}>
          {status === 'changes' ? <><Edit width={12} height={12} />Changes requested</> : status === 'approved' ? <><Check width={12} height={12} />Approved ({approvals})</> : 'Awaiting review'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copyLink} disabled={busy} className="btn-outline btn-sm">{copied ? <><Check width={15} height={15} /> Link copied</> : 'Copy preview link'}</button>
        {changeReqs.length > 1 && <button onClick={() => popOut(changeReqs, 'All change requests')} className="btn-ghost btn-sm">Pop out all change requests ↗</button>}
        <span className="text-xs text-[var(--muted)]">A private link to this draft as a reader sees it. Anyone with it can view + leave a named approval or change request.</span>
      </div>

      {reviews.length > 0 && (
        <div className="mt-4 space-y-2">
          {reviews.map((r) => {
            const change = r.decision === 'change';
            const expanded = openId === r.id;
            return (
              <div key={r.id} className={`rounded-xl border ${change && !r.resolved ? 'border-amber-300 bg-amber-50/60' : 'border-[var(--border)]'}`}>
                <div className="flex flex-wrap items-center gap-2 p-3">
                  {/* A change request is a click-to-open row (one at a time); an approval is just a line. */}
                  {change && r.message ? (
                    <button onClick={() => setOpenId(expanded ? null : r.id)} className="flex flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
                      <span className="badge inline-flex items-center gap-1 bg-amber-100 text-amber-800"><Edit width={11} height={11} />Change</span>
                      <span className="font-semibold">{r.firstName} {r.lastName}</span>
                      <span className="text-xs text-[var(--muted)]">{formatDate(r.createdAt)}</span>
                      <span className="text-xs font-semibold text-brand-600">{expanded ? 'Hide' : 'Open'}</span>
                    </button>
                  ) : (
                    <span className="flex flex-1 items-center gap-2">
                      <span className={`badge inline-flex items-center gap-1 ${change ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>{change ? <><Edit width={11} height={11} />Change</> : <><Check width={11} height={11} />Approved</>}</span>
                      <span className="font-semibold">{r.firstName} {r.lastName}</span>
                      <span className="text-xs text-[var(--muted)]">{formatDate(r.createdAt)}</span>
                    </span>
                  )}
                  {change && r.resolved && <span className="badge bg-[var(--card-2)] text-[var(--muted)]">resolved</span>}
                  <span className="flex items-center gap-1">
                    {change && r.message && <button onClick={() => popOut([r], `Change request — ${r.firstName} ${r.lastName}`)} className="btn-ghost btn-sm" title="Open in its own window">Pop out ↗</button>}
                    {change && !r.resolved && <button onClick={() => run(() => resolveArticleReview(r.id))} disabled={busy} className="btn-ghost btn-sm">Mark resolved</button>}
                    <button onClick={() => run(() => deleteArticleReview(r.id))} disabled={busy} aria-label="Delete review" className="grid h-7 w-7 place-items-center rounded text-[var(--muted)] hover:text-red-600"><X width={14} height={14} /></button>
                  </span>
                </div>
                {change && r.message && expanded && (
                  <div className="border-t border-amber-200 p-3">
                    <p className="whitespace-pre-wrap text-sm text-[var(--fg)]">{r.message}</p>
                    <button onClick={() => copyText(r.id, r.message)} className="btn-outline btn-sm mt-3">{copiedId === r.id ? <><Check width={14} height={14} /> Copied</> : 'Copy text'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
