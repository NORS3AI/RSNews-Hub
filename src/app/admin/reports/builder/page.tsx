import Link from 'next/link';
import { buildReport, reportAdvertisers, parseReportParams, reportQuery, type Viz } from '@/lib/reportData';
import ReportControls from '@/components/admin/ReportControls';
import ReportSectionView from '@/components/admin/ReportSectionView';
import { ArrowLeft } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Report builder' };

export default async function ReportBuilderPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const params = parseReportParams(sp);
  const advertisers = await reportAdvertisers(params.days);

  // Default the advertiser scope to the first brand so there's always a preview.
  if (params.scope === 'advertiser' && !params.brand && advertisers.length) params.brand = advertisers[0];

  const report = (params.scope === 'advertiser' && !params.brand)
    ? null
    : await buildReport(params.scope, params.days, params.brand);

  const hidden = new Set(params.hide);
  const exportHref = `/report-export?${reportQuery(params)}`;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Performance reports</Link>
      <h1 className="mb-1 text-2xl font-bold">Report builder</h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">Build a report for the whole site or one advertiser, choose which sections to include and how to show each, then open a printable version to save as PDF.</p>

      <ReportControls
        scope={params.scope}
        days={params.days}
        brand={params.brand}
        advertisers={advertisers}
        sections={(report?.sections ?? []).map((s) => ({ id: s.id, title: s.title, allowed: s.allowed }))}
        hide={params.hide}
        vizMap={params.vizMap}
        exportHref={exportHref}
      />

      {!report ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">Choose an advertiser to preview their report.</p>
      ) : (
        <div className="card p-5">
          <div className="mb-4 border-b border-[var(--border)] pb-3">
            <h2 className="text-xl font-black">{report.title}</h2>
            <p className="text-sm text-[var(--muted)]">{report.subtitle}</p>
          </div>
          {report.sections.filter((s) => !hidden.has(s.id)).map((s) => (
            <ReportSectionView key={s.id} section={s} viz={params.vizMap[s.id] as Viz | undefined} />
          ))}
          {report.sections.every((s) => hidden.has(s.id)) && <p className="text-sm text-[var(--muted)]">All sections are hidden — enable one above.</p>}
        </div>
      )}
    </div>
  );
}
