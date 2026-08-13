'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { pushArticleToVendorReview } from '@/lib/actions';
import { formatDateTimeUTC } from '@/lib/utils';

type Vendor = { id: string; name: string };
type TrailItem = { id: string; createdAt: Date | string; vendorName: string; decision: string | null; decidedAt: Date | string | null; message: string };

// Admin panel under the editor: push this article to a vendor's dashboard for
// review, and see the timestamped history of every round (the paper trail). Works
// for sponsored articles and vendors' What's Hot pieces. Their Approve /
// Request-changes reply also lands in the review feedback above.
export default function VendorReviewPush({
  articleId, vendors, defaultVendorId, trail,
}: { articleId: string; vendors: Vendor[]; defaultVendorId: string | null; trail: TrailItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vendorId, setVendorId] = useState(defaultVendorId || (vendors[0]?.id ?? ''));
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const send = () => {
    if (!vendorId) { setErr('Pick a vendor to send this to.'); return; }
    setErr(''); setOk(false);
    const fd = new FormData(); fd.set('articleId', articleId); fd.set('vendorId', vendorId);
    start(async () => {
      try { await pushArticleToVendorReview(fd); setOk(true); router.refresh(); }
      catch (e) { setErr((e as Error)?.message || 'Could not send — please try again.'); }
    });
  };

  return (
    <div className="card mt-4 p-4">
      <h3 className="font-semibold">Send to a vendor’s dashboard</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">
        The vendor sees this on their dashboard and can Approve or Request changes. Each send is a new round; their reply also appears in the reviews above. Use it for sponsored articles and for vendors’ What’s Hot pieces.
      </p>
      {vendors.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No vendors on record yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="input h-9 min-w-52">
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <button onClick={send} disabled={pending} className="btn-primary btn-sm">{pending ? 'Sending…' : 'Send for review'}</button>
          {ok && <span className="text-sm text-green-600">Sent.</span>}
        </div>
      )}
      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}

      {trail.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Review history</div>
          <ul className="space-y-1.5 text-sm">
            {trail.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{t.vendorName}</span>
                <span className="text-[var(--muted)]">sent {formatDateTimeUTC(t.createdAt)}</span>
                <span aria-hidden>·</span>
                {t.decidedAt
                  ? <span className={t.decision === 'approve' ? 'text-green-700' : 'text-amber-700'}>
                      {t.decision === 'approve' ? 'approved' : 'changes requested'} {formatDateTimeUTC(t.decidedAt)}
                    </span>
                  : <span className="text-[var(--muted)]">awaiting response</span>}
                {t.decision === 'change' && t.message && <span className="w-full whitespace-pre-wrap pl-1 text-[13px] text-[var(--muted)]">“{t.message}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
