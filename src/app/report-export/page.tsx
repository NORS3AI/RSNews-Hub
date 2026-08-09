import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { buildReport, parseReportParams, type Viz } from '@/lib/reportData';
import ReportSectionView from '@/components/admin/ReportSectionView';
import PrintButton from '@/components/site/PrintButton';
import { SITE_NAME } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Report' };

// Standalone, print-optimized analytics report (no admin chrome) — staff open it
// from the report builder and save it as PDF for leadership. Admin-only.
export default async function ReportExportPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const user = await requireAdmin();

  const wrap = (children: React.ReactNode) => <main className="mx-auto max-w-3xl px-6 py-10 text-[var(--fg)]">{children}</main>;
  if (!user) {
    return wrap(<div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"><p className="font-semibold">Staff only.</p><Link href="/login" className="btn-primary btn-sm mt-3">Sign in</Link></div>);
  }

  const params = parseReportParams(sp);
  if (params.scope === 'advertiser' && !params.brand) return wrap(<p className="text-[var(--muted)]">No advertiser selected.</p>);

  const report = await buildReport(params.scope, params.days, params.brand);
  const hidden = new Set(params.hide);
  const sections = report.sections.filter((s) => !hidden.has(s.id));

  return wrap(
    <>
      <style>{`@media print { [data-noprint]{display:none!important} @page{margin:16mm} body{background:#fff} }`}</style>

      <div data-noprint className="mb-6 flex items-center justify-between gap-3">
        <Link href={`/admin/reports/builder?${new URLSearchParams(sp as Record<string, string>).toString()}`} className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">← Back to builder</Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow-card)] print:border-0 print:shadow-none">
        <header className="mb-6 border-b-2 border-brand-600 pb-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">{SITE_NAME} · Analytics report</div>
          <h1 className="mt-1 text-3xl font-black leading-tight">{report.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{report.subtitle} · generated {formatDate(new Date())}</p>
        </header>

        {sections.length === 0
          ? <p className="text-[var(--muted)]">No sections selected.</p>
          : sections.map((s) => <ReportSectionView key={s.id} section={s} viz={params.vizMap[s.id] as Viz | undefined} />)}

        <footer className="mt-8 border-t border-[var(--border)] pt-4 text-center text-[11px] text-[var(--muted)]">
          Compiled by {SITE_NAME}.
        </footer>
      </article>
    </>
  );
}
