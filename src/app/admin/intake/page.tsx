import Link from 'next/link';
import { prisma } from '@/lib/db';
import { confirmIntakeVendor } from '@/lib/actions';
import { formatDate } from '@/lib/utils';
import { AUTO_MATCH, SUGGEST_MATCH } from '@/lib/vendorMatch';

export const dynamic = 'force-dynamic';

const statusChip: Record<string, string> = {
  PROCESSED: 'bg-green-100 text-green-700',
  RECEIVED: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
};

const matchChip: Record<string, string> = {
  auto: 'bg-green-100 text-green-700',
  confirmed: 'bg-green-100 text-green-700',
  suggested: 'bg-amber-100 text-amber-700',
  suggest: 'bg-amber-100 text-amber-700',
  new: 'bg-blue-100 text-blue-700',
};

export default async function AdminIntake() {
  const subs = await prisma.contentSubmission.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const vendors = await prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  // Which submissions still need the admin to confirm a vendor (a plausible but
  // uncertain match we deliberately did NOT merge).
  const needsConfirm = subs.filter((s) => s.status === 'PROCESSED' && !s.vendorId && s.matchStatus === 'suggest');
  const failed = subs.filter((s) => s.status === 'FAILED').length;

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Sponsored intake</h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        Sponsored-article submissions arrive from JotForm and the Hub builds each into a <strong>draft</strong> — company copy becomes the article body, the uploaded creative becomes a reserved in-article ad, and the vendor is matched automatically. Nothing is ever published here: open the draft, confirm the vendor if asked, then publish it from the article editor.
      </p>

      {(needsConfirm.length > 0 || failed > 0) && (
        <div className="mb-5 space-y-2">
          {needsConfirm.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <strong>{needsConfirm.length} submission{needsConfirm.length === 1 ? ' needs' : 's need'} a vendor confirmed</strong> — the company name closely resembles an existing vendor, so it wasn’t merged automatically. Confirm the match (or create a new vendor) below.
            </div>
          )}
          {failed > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              <strong>{failed} submission{failed === 1 ? '' : 's'} failed</strong> to process (e.g. missing company name or a field-map mismatch). Check the ingestion logs / content field map.
            </div>
          )}
        </div>
      )}

      {subs.length === 0 ? (
        <div className="card p-6 text-sm text-[var(--muted)]">
          No submissions yet. Point your sponsored-content JotForm webhook at <code className="rounded bg-[var(--bg-soft)] px-1">/api/ingest/content?key=…</code> and they’ll land here as drafts.
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => {
            const pending = s.status === 'PROCESSED' && !s.vendorId && s.matchStatus === 'suggest';
            const boundName = s.vendorId ? vendorName.get(s.vendorId) : null;
            const suggestedName = s.matchVendorId ? vendorName.get(s.matchVendorId) : null;
            return (
              <div key={s.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.matchName || 'Unknown company'}</span>
                      <span className={`badge ${statusChip[s.status] ?? ''}`}>{s.status}</span>
                      <span className={`badge ${matchChip[s.matchStatus] ?? 'bg-[var(--bg-soft)]'}`}>
                        {s.matchStatus}{s.confidence ? ` · ${s.confidence}%` : ''}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-[var(--muted)]">
                      {s.headline || '(no headline)'} · {formatDate(s.createdAt)}
                      {boundName ? <> · vendor: <strong>{boundName}</strong></> : null}
                    </div>
                    {s.error ? <div className="mt-1 text-xs text-amber-700">Notes: {s.error}</div> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.articleId && (
                      <Link href={`/admin/articles/${s.articleId}`} className="btn-outline btn-sm">Open draft</Link>
                    )}
                    {s.adId && (
                      <Link href="/admin/ads" className="btn-outline btn-sm">Reserved ad</Link>
                    )}
                  </div>
                </div>

                {/* Vendor control on every processed submission: a held match is
                    CONFIRMED here (confirm-before-merge); an already-bound one can be
                    swapped to the right advertiser at any time. */}
                {s.status === 'PROCESSED' && (
                  <form action={confirmIntakeVendor} className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
                    <input type="hidden" name="submissionId" value={s.submissionId} />
                    <div className="min-w-56 flex-1">
                      <label className="label text-xs">
                        {pending
                          ? <>Confirm the vendor for “{s.matchName}”{suggestedName ? <> — closest match: <strong>{suggestedName}</strong> ({s.confidence}%)</> : null}</>
                          : <>Vendor: <strong>{boundName || 'unassigned'}</strong> — change it if this belongs to a different advertiser</>}
                      </label>
                      <select name="vendorId" className="input h-9" defaultValue={s.vendorId ?? s.matchVendorId ?? 'new'}>
                        {pending && s.matchVendorId && <option value={s.matchVendorId}>Use “{suggestedName}” (the suggested match)</option>}
                        <option value="new">Create a new vendor “{s.matchName}”</option>
                        <optgroup label="Assign to a vendor">
                          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <button className={pending ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}>{pending ? 'Confirm vendor' : 'Change vendor'}</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-xs text-[var(--muted)]">
        A match at or above {AUTO_MATCH}% auto-links; {SUGGEST_MATCH}–{AUTO_MATCH - 1}% is held for you to confirm; below {SUGGEST_MATCH}% creates a new (flagged) vendor.
      </p>
    </div>
  );
}
