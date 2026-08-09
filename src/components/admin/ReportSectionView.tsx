import type { ReportSection, Viz } from '@/lib/reportData';
import Sparkline from '@/components/admin/Sparkline';
import ReportTable, { type Col } from '@/components/admin/ReportTable';
import { BarChart, Pie, StatTiles } from '@/components/admin/ReportCharts';

/** Renders one report section with a chosen visualization (falling back to the
 *  section's default when the choice isn't supported). Shared by the builder
 *  preview and the printable export so they can never diverge. */
export default function ReportSectionView({ section, viz }: { section: ReportSection; viz?: Viz }) {
  const v: Viz = viz && section.allowed.includes(viz) ? viz : section.defaultViz;

  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-[var(--muted)]">{section.title}</h2>
      {v === 'stats' && section.stats && <StatTiles stats={section.stats} />}
      {v === 'trend' && section.trend && (
        <Sparkline points={section.trend.points} label={section.trend.label} value={section.trend.value} sub={section.trend.sub} />
      )}
      {v === 'bar' && section.slices && <BarChart rows={section.slices} />}
      {v === 'pie' && section.slices && <Pie rows={section.slices} />}
      {v === 'table' && section.table && (
        <ReportTable columns={section.table.columns as Col[]} rows={section.table.rows} filename={`${section.id}.csv`} />
      )}
    </section>
  );
}
