'use client';
import { useRouter, usePathname } from 'next/navigation';
import { RANGES, rangeLabel, type Viz } from '@/lib/reportData';
import { ExternalLink } from '@/components/icons';

type SectionMeta = { id: string; title: string; allowed: Viz[] };
const VIZ_LABEL: Record<Viz, string> = { stats: 'Stat tiles', bar: 'Bar chart', pie: 'Pie chart', table: 'Table', trend: 'Trend line' };

/** The report builder's control panel. Every change re-navigates with the new
 *  querystring so the server re-renders the preview; the same querystring feeds
 *  the printable export. */
export default function ReportControls({
  scope, days, brand, advertisers, sections, hide, vizMap, exportHref,
}: {
  scope: 'site' | 'advertiser'; days: number; brand: string; advertisers: string[];
  sections: SectionMeta[]; hide: string[]; vizMap: Record<string, string>; exportHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hidden = new Set(hide);

  function go(next: { scope?: string; brand?: string; days?: number; hide?: Set<string>; viz?: Record<string, string> }) {
    const p = new URLSearchParams();
    const s = next.scope ?? scope;
    p.set('scope', s);
    p.set('days', String(next.days ?? days));
    const b = next.brand ?? brand;
    if (s === 'advertiser' && b) p.set('brand', b);
    const h = next.hide ?? hidden;
    if (h.size) p.set('hide', [...h].join(','));
    const vm = next.viz ?? vizMap;
    const vizStr = Object.entries(vm).map(([k, v]) => `${k}:${v}`).join(',');
    if (vizStr) p.set('viz', vizStr);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="card mb-6 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label !mb-1 text-xs">Report</span>
          <select value={scope} onChange={(e) => go({ scope: e.target.value, hide: new Set(), viz: {} })} className="input h-9 w-auto py-1 text-sm">
            <option value="site">Whole site</option>
            <option value="advertiser">One advertiser</option>
          </select>
        </label>
        {scope === 'advertiser' && (
          <label className="block">
            <span className="label !mb-1 text-xs">Advertiser</span>
            <select value={brand} onChange={(e) => go({ brand: e.target.value })} className="input h-9 w-auto py-1 text-sm">
              <option value="" disabled>Choose…</option>
              {advertisers.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="label !mb-1 text-xs">Range</span>
          <select value={days} onChange={(e) => go({ days: Number(e.target.value) })} className="input h-9 w-auto py-1 text-sm">
            {RANGES.map((d) => <option key={d} value={d}>{rangeLabel(d)}</option>)}
          </select>
        </label>
        <a href={exportHref} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm ml-auto">Open printable report <ExternalLink width={13} height={13} /></a>
      </div>

      {sections.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Include &amp; show as</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {sections.map((s) => {
              const on = !hidden.has(s.id);
              const cur = vizMap[s.id] ?? '';
              return (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                  <label className="flex flex-1 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={on} onChange={() => { const h = new Set(hidden); if (on) h.add(s.id); else h.delete(s.id); go({ hide: h }); }} className="h-4 w-4" />
                    {s.title}
                  </label>
                  {s.allowed.length > 1 && (
                    <select value={cur || s.allowed[0]} disabled={!on}
                      onChange={(e) => go({ viz: { ...vizMap, [s.id]: e.target.value } })}
                      className="input h-8 w-auto py-0.5 text-xs disabled:opacity-40">
                      {s.allowed.map((v) => <option key={v} value={v}>{VIZ_LABEL[v]}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
