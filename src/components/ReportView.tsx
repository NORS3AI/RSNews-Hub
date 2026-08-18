import type { ReportSnapshot } from '@/lib/reports';

const pctStr = (f: number) => `${(f * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString('en-US');

function Stat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div
      className={`group relative rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-3${tip ? ' cursor-help' : ''}`}
      tabIndex={tip ? 0 : undefined}
      title={tip}>
      {tip && <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full border border-[var(--border)] text-[9px] font-black leading-none text-[var(--muted)] opacity-45 transition-opacity group-hover:opacity-90">i</span>}
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      {tip && (
        <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[230px] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--fg)] px-3 py-2 text-left text-[11px] font-normal leading-snug text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
          {tip}
        </span>
      )}
    </div>
  );
}

function Table({ title, rows, firstCol = 'Name' }: { title: string; rows: ReportSnapshot['byCreative']; firstCol?: string }) {
  if (!rows.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-1 pr-3 font-medium">{firstCol}</th>
              <th className="py-1 pr-3 text-right font-medium" title="How many times your ads were shown on a page.">Impressions</th>
              <th className="py-1 pr-3 text-right font-medium" title="How many times readers clicked your ads.">Clicks</th>
              <th className="py-1 text-right font-medium" title="Click-through rate — clicks ÷ viewable impressions.">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--border)]">
                <td className="py-1.5 pr-3">{r.key}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{n(r.impressions)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{n(r.clicks)}</td>
                <td className="py-1.5 text-right tabular-nums">{pctStr(r.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Presentational render of a report snapshot — shared by the admin review page
 *  and the vendor dashboard so both show identical numbers. */
export default function ReportView({ snapshot }: { snapshot: ReportSnapshot }) {
  const t = snapshot.totals;
  const hasData = t.impressions > 0 || t.clicks > 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Impressions" value={n(t.impressions)} tip="How many times your ads were shown on a page during this period." />
        <Stat label="Viewable" value={n(t.viewable)} tip="Of those, how many actually scrolled into a reader's view — the fair basis for your click rate." />
        <Stat label="Clicks" value={n(t.clicks)} tip="How many times readers clicked your ads through to your link." />
        <Stat label="CTR" value={pctStr(t.ctr)} tip="Click-through rate — clicks ÷ viewable impressions. Measured against viewable (not every) impression so ad placement doesn't distort it." />
        <Stat label="Avg. dwell" value={`${(t.avgDwellMs / 1000).toFixed(1)}s`} tip="On average, how long your ad stayed in a reader's view — a sense of the attention it held." />
        <Stat label="Above the fold" value={pctStr(t.aboveFoldPct)} tip="The share of your impressions shown near the top of the page, visible without scrolling." />
      </div>
      {!hasData && (
        <p className="text-sm text-[var(--muted)]">No ad activity was recorded for this period.</p>
      )}
      <Table title="By creative" rows={snapshot.byCreative} />
      <Table title="By placement" rows={snapshot.byPlacement} />
      <Table title="By campaign batch" rows={snapshot.byBatch ?? []} firstCol="Batch" />
      <Table title="Inside sponsored articles" rows={snapshot.bySponsoredArticle ?? []} firstCol="Sponsored article" />
    </div>
  );
}
