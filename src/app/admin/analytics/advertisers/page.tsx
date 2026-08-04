import Link from 'next/link';
import { loadEvents } from '@/lib/analytics/query';
import { advertiserList, advertiserReport } from '@/lib/analytics/metrics';
import ReportTable from '@/components/admin/ReportTable';

export const dynamic = 'force-dynamic';
const DAYS = [7, 30, 90];

const nf = (n: number) => n.toLocaleString();
const pctStr = (n: number) => `${Math.round(n * 100)}%`;
const fmtMs = (ms: number) => { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

export default async function AdvertiserReports(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const days = DAYS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const { events } = await loadEvents(days);
  const advertisers = advertiserList(events);
  const brand = advertisers.includes(searchParams.brand ?? '') ? searchParams.brand! : advertisers[0];
  const report = brand ? advertiserReport(events, brand) : null;

  const url = (b: string, d = days) => `/admin/analytics/advertisers?days=${d}&brand=${encodeURIComponent(b)}`;

  return (
    <div className="max-w-5xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/admin/analytics?days=${days}`} className="text-sm font-semibold text-brand-600 hover:underline">← Analytics</Link>
          <h1 className="text-2xl font-bold">Advertiser reports</h1>
        </div>
        <div className="inline-flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-0.5">
          {DAYS.map((d) => (
            <Link key={d} href={url(brand ?? '', d)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${days === d ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>{d}d</Link>
          ))}
        </div>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-[var(--muted)]">Each report is scoped to a single advertiser — <strong>only their own brand&apos;s data</strong>. Safe to export and hand to the vendor.</p>

      {advertisers.length === 0 ? (
        <div className="card p-8 text-center text-[var(--muted)]">No advertiser data in this window yet.</div>
      ) : (
        <>
          {/* Advertiser picker */}
          <div className="mb-6 flex flex-wrap gap-1.5">
            {advertisers.map((b) => (
              <Link key={b} href={url(b)} className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${b === brand ? 'bg-brand-600 text-white' : 'border border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>{b}</Link>
            ))}
          </div>

          {report && (
            <div className="space-y-7">
              <div>
                <h2 className="mb-2.5 text-lg font-black">{report.brand}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Tile label="Impressions" value={nf(report.totals.impressions)} />
                  <Tile label="Viewable" value={nf(report.totals.viewable)} />
                  <Tile label="Above fold" value={pctStr(report.totals.aboveFoldPct)} />
                  <Tile label="Avg dwell" value={fmtMs(report.totals.avgDwellMs)} />
                  <Tile label="Clicks" value={nf(report.totals.clicks)} />
                  <Tile label="CTR" value={pctStr(report.totals.ctr)} />
                </div>
              </div>

              <div>
                <Head>Top creatives — which of their ads performed best</Head>
                <ReportTable
                  columns={[{ key: 'key', label: 'Creative' }, { key: 'impressions', label: 'Impr.', type: 'int' }, { key: 'viewable', label: 'Viewable', type: 'int' }, { key: 'avgDwellMs', label: 'Avg dwell', type: 'ms' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }]}
                  rows={report.byCreative}
                  filename={`${brand}-creatives-${days}d`}
                />
              </div>

              <div>
                <Head>By placement — where their ads did best</Head>
                <ReportTable
                  columns={[{ key: 'key', label: 'Placement' }, { key: 'impressions', label: 'Impr.', type: 'int' }, { key: 'viewable', label: 'Viewable', type: 'int' }, { key: 'aboveFoldPct', label: 'Above fold', type: 'pct01' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }]}
                  rows={report.byPlacement}
                  filename={`${brand}-placements-${days}d`}
                />
              </div>

              <div>
                <Head>Daily trend</Head>
                <ReportTable
                  columns={[{ key: 'key', label: 'Day' }, { key: 'impressions', label: 'Impr.', type: 'int' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }]}
                  rows={report.trend}
                  filename={`${brand}-daily-${days}d`}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3.5">
      <div className="text-2xl font-black leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}</div>
    </div>
  );
}
function Head({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--muted)]">{children}</h3>;
}
