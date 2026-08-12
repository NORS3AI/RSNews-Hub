import Link from 'next/link';
import { prisma } from '@/lib/db';
import { generatePerformanceReport } from '@/lib/actions';
import { recentQuarters } from '@/lib/reports';
import { listReportTemplates } from '@/lib/reportTemplates';
import { formatDate, formatDateUTC } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusChip: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700',
  DRAFT: 'bg-amber-100 text-amber-700',
};

export default async function AdminReports() {
  const [vendors, reports, templates] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.performanceReport.findMany({ orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }], include: { vendor: { select: { name: true } } } }),
    listReportTemplates(),
  ]);
  const quarters = recentQuarters(new Date(), 6);

  return (
    <div className="max-w-5xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Performance reports</h1>
        <Link href="/admin/reports/builder" className="btn-outline btn-sm">📊 Report builder</Link>
      </div>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        Auto-draft a quarterly ad-performance summary for a vendor from the analytics we already collect, review and add a note, then <strong>publish</strong> it to their dashboard. Vendors only ever see published reports. For a custom, exportable report (whole-site or one advertiser, your choice of charts) use the <strong>Report builder</strong>.
      </p>

      {templates.length > 0 && (
        <div className="card mb-6 p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Saved report templates · one press for fresh numbers</div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Link key={t.id} href={`/admin/reports/builder?${t.query}`} className="btn-outline btn-sm">📊 {t.name}</Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Generate */}
        <form action={generatePerformanceReport} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">New report</h2>
          {vendors.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No vendors yet. Create an ad campaign first — the vendor is created with it.</p>
          ) : (
            <>
              <div>
                <label className="label">Vendor</label>
                <select name="vendorId" required className="input" defaultValue="">
                  <option value="" disabled>Choose a vendor…</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Quarter</label>
                <select name="periodStart" required className="input" defaultValue={quarters[0]?.start.toISOString()}>
                  {quarters.map((q) => <option key={q.label} value={q.start.toISOString()}>{q.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-[var(--muted)]">Only completed quarters are listed. Re-generating refreshes the numbers and returns the report to draft.</p>
              </div>
              <button className="btn-primary w-full">Generate draft</button>
            </>
          )}
        </form>

        {/* List */}
        <div className="space-y-3 lg:col-span-2">
          {reports.length === 0 && <p className="text-[var(--muted)]">No reports yet. Generate the first on the left.</p>}
          {reports.map((r) => (
            <Link key={r.id} href={`/admin/reports/${r.id}`} className="card block p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{r.vendor.name} · {r.periodLabel}</span>
                <span className={`badge ${statusChip[r.status] ?? ''}`}>{r.status}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {formatDateUTC(r.periodStart)} → {formatDateUTC(r.periodEnd)}
                {r.publishedAt && <> · published {formatDate(r.publishedAt)}</>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
