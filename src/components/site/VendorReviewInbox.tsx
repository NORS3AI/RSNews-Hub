'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitVendorReviewDecision } from '@/lib/actions';
import { formatDateTimeUTC, formatDateUTC } from '@/lib/utils';
import { Check, ExternalLink } from '@/components/icons';

export type VendorReviewCard = {
  id: string;
  createdAt: Date | string;
  decision: string | null;
  message: string;
  decidedAt: Date | string | null;
  article: {
    id: string; title: string; slug: string; status: string;
    publishedAt: Date | string | null; sponsoredUntil: Date | string | null; previewToken: string | null;
    genre: string; categoryName: string | null;
  };
};

// The article-type prefix a vendor sees: "Sponsored" (genre, not a category) wins;
// otherwise the primary category ("What's Hot", …). '' when neither applies.
function typeLabel(a: VendorReviewCard['article']): string {
  if (a.genre === 'sponsored') return 'Sponsored article';
  if (a.categoryName) return `${a.categoryName} article`;
  return '';
}

// The vendor's review inbox on their dashboard. Each card is one round the admin
// pushed. A pending round is actionable (preview + Approve / Request changes);
// once answered it LOCKS (grays out, no reopen/flip). When the article publishes,
// the card shows the posted date (+ the ~30-day homepage note for sponsored).
export default function VendorReviewInbox({ reviews }: { reviews: VendorReviewCard[] }) {
  if (!reviews.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-bold">Your articles to review</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">
        We’ve shared these for your review. Open one, then approve it or request changes. Once you respond it locks — if we make further edits, a new review appears here.
      </p>
      <div className="space-y-3">
        {reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
      </div>
    </section>
  );
}

function ReviewCard({ r }: { r: VendorReviewCard }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showChange, setShowChange] = useState(false);

  const published = r.article.status === 'PUBLISHED';
  const locked = !!r.decidedAt;
  const a = r.article;

  const submit = (decision: 'approve' | 'change') => {
    setErr('');
    if (decision === 'change' && !msg.trim()) { setErr('Add a note describing the changes you’d like.'); return; }
    const fd = new FormData();
    fd.set('requestId', r.id); fd.set('decision', decision); fd.set('message', msg);
    start(async () => {
      try { await submitVendorReviewDecision(fd); router.refresh(); }
      catch (e) { setErr((e as Error)?.message || 'Something went wrong — please try again.'); }
    });
  };

  return (
    <div className={`card p-4 ${locked && !published ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {typeLabel(a) && <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600">{typeLabel(a)}</div>}
          {/* Once published, the title links straight to the live article. */}
          {published
            ? <a href={`/docs/article/${a.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">{a.title}</a>
            : <div className="font-semibold">{a.title}</div>}
          <div className="text-xs text-[var(--muted)]">Sent for review {formatDateTimeUTC(r.createdAt)}</div>
        </div>
        {!published && !locked && a.previewToken && (
          <a href={`/docs/article/${a.slug}?preview=${a.previewToken}&dash=1`} target="_blank" rel="noopener noreferrer"
            className="btn-outline btn-sm inline-flex items-center gap-1.5 whitespace-nowrap">
            <ExternalLink width={14} height={14} /> Preview
          </a>
        )}
      </div>

      {/* Published — the article is live. */}
      {published ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          <div className="flex items-center gap-1.5 font-semibold"><Check width={15} height={15} /> Posted {a.publishedAt ? formatDateUTC(a.publishedAt) : ''}</div>
          {a.sponsoredUntil && <div className="mt-0.5 text-[13px]">Guaranteed near the top of the homepage for 30 days.</div>}
          <a href={`/docs/article/${a.slug}`} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-green-800 hover:underline dark:text-green-300">
            <ExternalLink width={13} height={13} /> View your live article
          </a>
          {locked && <div className="mt-1 text-[12px] text-green-700/80">You {r.decision === 'approve' ? 'approved this' : 'requested changes'} on {formatDateTimeUTC(r.decidedAt)}.</div>}
        </div>
      ) : locked ? (
        /* Answered — locked, can't reopen or flip. */
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-sm">
          <div className="font-semibold text-[var(--fg)]">
            {r.decision === 'approve' ? '✓ You approved this' : '✎ You requested changes'} · {formatDateTimeUTC(r.decidedAt)}
          </div>
          {r.decision === 'change' && r.message && <div className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--muted)]">{r.message}</div>}
          <div className="mt-1 text-[12px] text-[var(--muted)]">This response is locked. If we make edits, a new review will appear above.</div>
        </div>
      ) : (
        /* Pending — actionable. */
        <div className="mt-3 space-y-2">
          {showChange && (
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={5000}
              placeholder="What would you like changed?" className="input w-full text-sm" />
          )}
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={pending} onClick={() => submit('approve')} className="btn-primary btn-sm inline-flex items-center gap-1.5">
              <Check width={15} height={15} /> Approve
            </button>
            {showChange
              ? <button disabled={pending} onClick={() => submit('change')} className="btn-outline btn-sm">Send change request</button>
              : <button disabled={pending} onClick={() => setShowChange(true)} className="btn-outline btn-sm">Request changes</button>}
            {pending && <span className="text-xs text-[var(--muted)]">Saving…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
