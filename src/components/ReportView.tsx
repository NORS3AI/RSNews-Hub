import type { ReportSnapshot } from '@/lib/reports';

const pctStr = (f: number) => `${(f * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString('en-US');

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: ReportSnapshot['byCreative'] }) {
  if (!rows.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-1 pr-3 font-medium">Name</th>
              <th className="py-1 pr-3 text-right font-medium">Impressions</th>
              <th className="py-1 pr-3 text-right font-medium">Clicks</th>
              <th className="py-1 text-right font-medium">CTR</th>
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
        <Stat label="Impressions" value={n(t.impressions)} />
        <Stat label="Viewable" value={n(t.viewable)} />
        <Stat label="Clicks" value={n(t.clicks)} />
        <Stat label="CTR" value={pctStr(t.ctr)} />
        <Stat label="Avg. dwell" value={`${(t.avgDwellMs / 1000).toFixed(1)}s`} />
        <Stat label="Above the fold" value={pctStr(t.aboveFoldPct)} />
      </div>
      {!hasData && (
        <p className="text-sm text-[var(--muted)]">No ad activity was recorded for this period.</p>
      )}
      <Table title="By creative" rows={snapshot.byCreative} />
      <Table title="By placement" rows={snapshot.byPlacement} />
    </div>
  );
}
