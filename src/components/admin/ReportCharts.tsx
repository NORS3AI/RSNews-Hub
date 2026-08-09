// Dependency-free, server-rendered report charts (inline SVG) — safe in print
// and both themes. A metric can be shown as a bar chart, a donut/pie, or stat
// tiles; tables use the existing ReportTable. Categorical hues come from a
// validated colorblind-safe order (dataviz skill); every slice/bar also carries
// a text label + value, so identity never rests on color alone.

export type Slice = { key: string; count: number };

// Validated categorical order (light-mode hues; readable on cream + dark cards).
const HUES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#008300', '#e34948'];
const nf = (n: number) => Number(n).toLocaleString();

/** Horizontal bar chart — magnitude across a handful of categories. Single hue;
 *  each bar is directly labeled with its value. */
export function BarChart({ rows, suffix = '', max, color = 'var(--brand-600, #E97D34)' }: { rows: Slice[]; suffix?: string; max?: number; color?: string }) {
  if (!rows.length) return <p className="text-sm text-[var(--muted)]">No data in this range.</p>;
  const top = max ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-sm">
          <div className="w-40 shrink-0 truncate text-[var(--muted)]" title={r.key}>{r.key}</div>
          <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--bg-soft)]">
            <div className="h-full rounded" style={{ width: `${Math.max(2, (r.count / top) * 100)}%`, background: color }} />
          </div>
          <div className="w-16 shrink-0 text-right tabular-nums font-semibold">{nf(r.count)}{suffix}</div>
        </div>
      ))}
    </div>
  );
}

/** Donut chart — parts of a whole across a few categories, with a labelled legend. */
export function Pie({ rows }: { rows: Slice[] }) {
  const data = rows.filter((r) => r.count > 0);
  const total = data.reduce((s, r) => s + r.count, 0);
  if (!total) return <p className="text-sm text-[var(--muted)]">No data in this range.</p>;
  const R = 60, r0 = 34, C = 70; // viewBox 140, donut
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.count / total;
    const a1 = a0 + frac * 2 * Math.PI;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => `${(C + rad * Math.cos(ang)).toFixed(2)},${(C + rad * Math.sin(ang)).toFixed(2)}`;
    const dPath = `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r0)} A ${r0} ${r0} 0 ${large} 0 ${p(a0, r0)} Z`;
    a0 = a1;
    return { d: d, path: dPath, hue: HUES[i % HUES.length], frac };
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label="Distribution">
        {arcs.map((a) => (
          <path key={a.d.key} d={a.path} fill={a.hue} stroke="var(--card)" strokeWidth={2} />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {arcs.map((a) => (
          <li key={a.d.key} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: a.hue }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[var(--fg)]" title={a.d.key}>{a.d.key}</span>
            <span className="tabular-nums font-semibold">{nf(a.d.count)}</span>
            <span className="w-10 text-right tabular-nums text-[var(--muted)]">{Math.round(a.frac * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Stat tiles — a row of headline numbers. */
export function StatTiles({ stats }: { stats: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="tile p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{s.label}</div>
          <div className="mt-0.5 text-2xl font-black tabular-nums">{s.value}</div>
          {s.sub && <div className="text-[11px] text-[var(--muted)]">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}
