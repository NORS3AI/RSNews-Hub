import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { savePerformanceReportSummary, publishPerformanceReport, unpublishPerformanceReport } from '@/lib/actions';
import { parseSnapshot } from '@/lib/reports';
import ReportView from '@/components/ReportView';
import { formatDate } from '@/lib/utils';
import { ArrowLeft } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function AdminReportDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const report = await prisma.performanceReport.findUnique({ where: { id }, include: { vendor: { select: { name: true } } } });
  if (!report) notFound();

  const snapshot = parseSnapshot(report.metrics);
  const published = report.status === 'PUBLISHED';
  const saveSummary = savePerformanceReportSummary.bind(null, report.id);
  const publish = publishPerformanceReport.bind(null, report.id);
  const unpublish = unpublishPerformanceReport.bind(null, report.id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
        <ArrowLeft width={16} height={16} /> All reports
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{report.vendor.name} · {report.periodLabel}</h1>
          <p className="text-sm text-[var(--muted)]">{formatDate(report.periodStart)} → {formatDate(report.periodEnd)}</p>
        </div>
        <span className={`badge ${published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {published ? `Published ${report.publishedAt ? formatDate(report.publishedAt) : ''}` : 'Draft'}
        </span>
      </div>

      <div className="card mb-5 p-5">
        <ReportView snapshot={snapshot} />
      </div>

      <form action={saveSummary} className="card mb-4 space-y-3 p-5">
        <div>
          <label className="label" htmlFor="summary">Summary for the vendor</label>
          <textarea id="summary" name="summary" defaultValue={report.summary} rows={4} className="input"
            placeholder="A short note the vendor sees above the numbers — highlights, what worked, suggestions for next quarter." />
        </div>
        <button className="btn-secondary btn-sm">Save summary</button>
      </form>

      <div className="flex items-center gap-2">
        {published ? (
          <form action={unpublish}><button className="btn-secondary btn-sm">Unpublish</button></form>
        ) : (
          <form action={publish}><button className="btn-primary btn-sm">Publish to vendor</button></form>
        )}
        <p className="text-xs text-[var(--muted)]">
          {published ? 'This report is live on the vendor’s dashboard.' : 'Not visible to the vendor until published.'}
        </p>
      </div>
    </div>
  );
}
