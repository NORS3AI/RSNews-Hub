import Link from 'next/link';
import { prisma } from '@/lib/db';
import { loadEvents } from '@/lib/analytics/query';
import { advertiserList, advertiserReport } from '@/lib/analytics/metrics';
import { flightLabels } from '@/lib/reports';
import ReportTable, { type Col } from '@/components/admin/ReportTable';
import Tile from '@/components/admin/StatTile';

export const dynamic = 'force-dynamic';
const DAYS = [7, 30, 90];

const nf = (n: number) => n.toLocaleString();
const pctStr = (n: number) => `${Math.round(n * 100)}%`;

// Shared column definitions (with header tooltips) for the per-advertiser tables,
// so the metric descriptions are written once and can't drift between tables.
const TIP = {
  impr: 'Impressions — times the ad was rendered on a page.',
  viewable: 'Impressions that actually scrolled into the reader’s view.',
  aboveFold: 'Share shown at the top of the page, visible without scrolling.',
  dwell: 'Average time the ad spent in view — a proxy for attention.',
  clicks: 'Times readers clicked the ad.',
  ctr: 'Click-through rate = clicks ÷ viewable impressions.',
};
const dwellCols = (firstLabel: string): Col[] => [
  { key: 'key', label: firstLabel },
  { key: 'impressions', label: 'Impr.', type: 'int', tip: TIP.impr },
  { key: 'viewable', label: 'Viewable', type: 'int', tip: TIP.viewable },
  { key: 'avgDwellMs', label: 'Avg dwell', type: 'ms', tip: TIP.dwell },
  { key: 'clicks', label: 'Clicks', type: 'int', tip: TIP.clicks },
  { key: 'ctr', label: 'CTR', type: 'pct01', tip: TIP.ctr },
];
const foldCols = (firstLabel: string): Col[] => [
  { key: 'key', label: firstLabel },
  { key: 'impressions', label: 'Impr.', type: 'int', tip: TIP.impr },
  { key: 'viewable', label: 'Viewable', type: 'int', tip: TIP.viewable },
  { key: 'aboveFoldPct', label: 'Above fold', type: 'pct01', tip: TIP.aboveFold },
  { key: 'clicks', label: 'Clicks', type: 'int', tip: TIP.clicks },
  { key: 'ctr', label: 'CTR', type: 'pct01', tip: TIP.ctr },
];
const fmtMs = (ms: number) => { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

export default async function AdvertiserReports(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const days = DAYS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const { events } = await loadEvents(days);
  const advertisers = advertiserList(events);
  const brand = advertisers.includes(searchParams.brand ?? '') ? searchParams.brand! : advertisers[0];
  const report = brand ? advertiserReport(events, brand) : null;

  // Resolve the sponsored-article breakdown's articleId keys → readable titles.
  // (bySponsoredArticle is keyed by id so a renamed article still aggregates.)
  const sponsoredRows = report?.bySponsoredArticle ?? [];
  const titleById = new Map<string, string>();
  if (sponsoredRows.length) {
    const arts = await prisma.article.findMany({
      where: { id: { in: sponsoredRows.map((r) => r.key) } },
      select: { id: true, title: true },
    });
    for (const a of arts) titleById.set(a.id, a.title);
  }
  // Deleted-since article → a clean label, never a raw cuid (this table is exported
  // to vendors); mirrors the frozen report's 'Removed article' fallback.
  const sponsoredArticleRows = sponsoredRows.map((r) => ({ ...r, key: r.key === '—' ? '—' : (titleById.get(r.key) ?? 'Removed article') }));

  // Resolve the per-batch breakdown's flightId keys → "Batch N · dates" labels.
  const batchRowsRaw = report?.byBatch ?? [];
  const batchLabels = batchRowsRaw.length ? await flightLabels(batchRowsRaw.map((r) => r.key)) : new Map<string, string>();
  const batchRows = batchRowsRaw.map((r) => ({ ...r, key: r.key === '—' ? '—' : (batchLabels.get(r.key) ?? 'Removed batch') }));

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
                  <Tile label="Impressions" value={nf(report.totals.impressions)} tip="Times this advertiser's ads were rendered on a page in the window (whether or not the reader scrolled to them)." />
                  <Tile label="Viewable" value={nf(report.totals.viewable)} tip="Of those impressions, how many actually entered the reader's view (scrolled into the screen) — the fair basis for CTR." />
                  <Tile label="Above fold" value={pctStr(report.totals.aboveFoldPct)} tip="Share of impressions that appeared in the top of the page, visible without scrolling." />
                  <Tile label="Avg dwell" value={fmtMs(report.totals.avgDwellMs)} tip="Average time the ad spent in view — a proxy for how much attention it got." />
                  <Tile label="Clicks" value={nf(report.totals.clicks)} tip="Times a reader clicked through this advertiser's ads." />
                  <Tile label="CTR" value={pctStr(report.totals.ctr)} tip="Click-through rate = clicks ÷ viewable impressions. Using viewable (not all) impressions keeps a low-placed ad from looking unfairly worse than a top one." />
                </div>
              </div>

              <div>
                <Head>Top creatives — which of their ads performed best</Head>
                <ReportTable
                  columns={dwellCols('Creative')}
                  rows={report.byCreative}
                  filename={`${brand}-creatives-${days}d`}
                />
              </div>

              <div>
                <Head>By placement — where their ads did best</Head>
                <ReportTable
                  columns={foldCols('Placement')}
                  rows={report.byPlacement}
                  filename={`${brand}-placements-${days}d`}
                />
              </div>

              {batchRows.length > 0 && (
                <div>
                  <Head>By campaign batch — each flight (batch of creatives)</Head>
                  <ReportTable
                    columns={dwellCols('Batch')}
                    rows={batchRows}
                    filename={`${brand}-batches-${days}d`}
                  />
                </div>
              )}

              {sponsoredArticleRows.length > 0 && (
                <div>
                  <Head>Inside sponsored articles — their embedded ad, per piece</Head>
                  <ReportTable
                    columns={dwellCols('Sponsored article')}
                    rows={sponsoredArticleRows}
                    filename={`${brand}-sponsored-articles-${days}d`}
                  />
                </div>
              )}

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

function Head({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--muted)]">{children}</h3>;
}
