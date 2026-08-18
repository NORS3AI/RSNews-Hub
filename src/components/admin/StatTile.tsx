// Shared KPI tile for the admin dashboards. `tip` shows a plain-English
// description on hover AND keyboard focus, with a small "i" affordance and a
// native `title` fallback for touch + assistive tech — so every stat across
// admin explains exactly what it measures. Server component: CSS-only tooltip,
// no client JS. Defined once so the tooltip treatment never drifts across pages.
export default function StatTile({
  label, value, hint, tip,
}: { label: string; value: string; hint?: string; tip?: string }) {
  return (
    <div
      className={`card group relative p-3.5${tip ? ' cursor-help' : ''}`}
      tabIndex={tip ? 0 : undefined}
      title={tip}>
      {tip && <span aria-hidden className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full border border-[var(--border)] text-[9px] font-black leading-none text-[var(--muted)] opacity-45 transition-opacity group-hover:opacity-90">i</span>}
      <div className="text-2xl font-black leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}{hint ? <span className="ml-1 font-normal opacity-70">· {hint}</span> : ''}</div>
      {tip && (
        <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--fg)] px-3 py-2 text-left text-[11px] font-normal leading-snug text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
          {tip}
        </span>
      )}
    </div>
  );
}
