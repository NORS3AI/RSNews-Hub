// Tiny dependency-free trend chart (inline SVG, server-rendered). Draws a filled
// area + line for a numeric series, with the last value called out. No client JS.

export default function Sparkline({
  points, label, value, sub, color = 'var(--brand-600, #E97D34)',
}: {
  points: number[];
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const w = 240, h = 48, pad = 2;
  const max = Math.max(1, ...points);
  const n = points.length;
  const x = (i: number) => (n <= 1 ? pad : pad + (i * (w - 2 * pad)) / (n - 1));
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z` : '';

  return (
    <div className="card p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold text-[var(--muted)]">{label}</div>
        <div className="text-lg font-black leading-none tracking-tight">{value}</div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-12 w-full" preserveAspectRatio="none" role="img" aria-label={`${label} trend`}>
        {area && <path d={area} fill={color} opacity={0.14} />}
        {n > 1 && <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />}
        {n > 0 && <circle cx={x(n - 1)} cy={y(points[n - 1])} r={2.4} fill={color} />}
      </svg>
      {sub && <div className="mt-1 text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
