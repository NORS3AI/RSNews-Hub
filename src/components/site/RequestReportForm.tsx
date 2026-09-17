'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestVendorReport } from '@/lib/actions';
import { REPORT_PERIODS } from '@/lib/vendorReports';

const PERIODS = Object.entries(REPORT_PERIODS).map(([key, v]) => ({ key, label: v.label }));

// Vendor self-serve: request a compiled performance report for a period. The
// server rate-limits (one open request; one per 30 days); we surface its result.
export default function RequestReportForm({ disabled, disabledNote }: { disabled: boolean; disabledNote?: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState('quarter');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function submit() {
    setMsg(''); setErr('');
    start(async () => {
      try { await requestVendorReport(period); setMsg('Requested — we’ll compile it and send it over.'); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : 'Could not submit.'); }
    });
  }

  if (disabled) {
    return <p className="text-sm text-[var(--muted)]">{disabledNote || 'You have a report request in progress — we’ll send it soon.'}</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="label !mb-1 text-xs">Period</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input h-9 w-auto py-1 text-sm">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      <button onClick={submit} disabled={pending} className="btn-primary btn-sm">Request report</button>
      {msg && <span className="text-xs font-semibold text-green-600">{msg}</span>}
      {err && <span className="text-xs font-semibold text-red-500">{err}</span>}
    </div>
  );
}
