'use client';
import { useMemo, useState } from 'react';
import { toCsv } from '@/lib/analytics/csv';
import { Download, ChevronUp, ChevronDown } from '@/components/icons';

export type ColType = 'text' | 'int' | 'num' | 'pct01' | 'ms';
export type Col = { key: string; label: string; type?: ColType; tip?: string };
type Row = Record<string, string | number>;

const nf = (n: number) => Number(n).toLocaleString();
function fmt(v: string | number, type?: ColType): string {
  if (v == null) return '';
  if (type === 'int') return nf(Number(v));
  if (type === 'num') return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (type === 'pct01') return `${Math.round(Number(v) * 100)}%`;
  if (type === 'ms') { const s = Math.round(Number(v) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; }
  return String(v);
}

// CSV wants RAW numbers (no thousands commas, no %/s units) so cells land in
// Excel/Sheets as real numbers — summable and sortable. Percentages export as a
// plain number (50, not "50%"); durations as seconds. Text passes through.
function csvVal(v: string | number, type?: ColType): string | number {
  if (v == null || v === '') return '';
  if (type === 'pct01') return Math.round(Number(v) * 1000) / 10; // e.g. 50 or 12.5
  if (type === 'ms') return Math.round(Number(v) / 1000); // seconds
  if (type === 'int' || type === 'num') return Number(v);
  return String(v);
}

/**
 * Sortable, CSV-exportable report table. Rows are raw values (numbers stay
 * numeric so sorting + export are correct); the column `type` drives display.
 */
export default function ReportTable({ columns, rows, filename }: { columns: Col[]; rows: Row[]; filename: string }) {
  const [sortKey, setSortKey] = useState<string>(columns[0]?.key ?? '');
  const [dir, setDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    const numeric = col && col.type && col.type !== 'text';
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [rows, sortKey, dir, columns]);

  function sortBy(key: string) {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setDir(-1); }
  }

  function exportCsv() {
    const headers = columns.map((c) => c.label);
    const body = sorted.map((r) => columns.map((c) => csvVal(r[c.key], c.type)));
    const csv = toCsv(headers, body);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  if (!rows.length) return <p className="card p-4 text-sm text-[var(--muted)]">No data for this cut yet.</p>;

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button onClick={exportCsv} className="btn-outline btn-sm"><Download width={14} height={14} /> Export CSV</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              {columns.map((c, i) => {
                const active = c.key === sortKey;
                return (
                  <th key={c.key} className={`px-3 py-2.5 font-bold ${i === 0 ? '' : 'text-right'}`} title={c.tip}>
                    <button onClick={() => sortBy(c.key)} className={`inline-flex items-center gap-1 hover:text-[var(--fg)] ${active ? 'text-[var(--fg)]' : ''} ${c.tip ? 'cursor-help decoration-dotted underline-offset-2 [text-decoration-line:underline]' : ''}`}>
                      {c.label}
                      {active && (dir === 1 ? <ChevronUp width={12} height={12} /> : <ChevronDown width={12} height={12} />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-0">
                {columns.map((c, j) => (
                  <td key={c.key} className={`px-3 py-2.5 ${j === 0 ? 'font-semibold' : 'text-right tabular-nums text-[var(--muted)]'}`}>{fmt(r[c.key], c.type)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
