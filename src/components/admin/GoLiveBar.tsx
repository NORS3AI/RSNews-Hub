'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishHomeLayout, discardHomeDraft } from '@/lib/actions';
import { Check, Clock, X } from '@/components/icons';

type Scheduled = { module: string; label: string; at: string };

// Staging banner for the homepage layout: shows when the draft differs from what
// is live, with Go Live (publish) and Discard (revert to live) actions. When the
// arrangement contains elements scheduled for later, Go Live first confirms —
// so a spot that won't fill for days reads as "locked in for <date>", not broken.
export default function GoLiveBar({ pending, scheduled = [] }: { pending: boolean; scheduled?: Scheduled[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const run = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });
  const publish = () => run(async () => { await publishHomeLayout(); setConfirm(false); });

  const onGoLive = () => { if (scheduled.length) setConfirm(true); else publish(); };
  const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  if (!pending) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--muted)] shadow-card">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        The homepage is up to date — no pending changes.
      </div>
    );
  }
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-card dark:border-amber-900/60 dark:bg-amber-950/30">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          You have unpublished homepage changes — they aren&apos;t live yet.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={busy} onClick={() => run(discardHomeDraft)} className="btn-outline btn-sm">Discard</button>
          <button disabled={busy} onClick={onGoLive} className="btn-primary btn-sm">
            {busy ? 'Publishing…' : <><Check width={14} height={14} /> Go Live</>}
          </button>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !busy && setConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black tracking-tight"><Clock width={18} height={18} className="text-brand-600" /> Locked in — some spots fill later</h2>
              <button onClick={() => setConfirm(false)} disabled={busy} className="btn-ghost btn-sm !px-2" aria-label="Close"><X width={16} height={16} /></button>
            </div>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Publishing locks this arrangement now. Everything goes live immediately <strong>except</strong> these scheduled elements — their spots are held exactly where you placed them and fill on their date:
            </p>
            <ul className="mb-4 max-h-56 space-y-1.5 overflow-y-auto">
              {scheduled.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-3 py-2 text-sm">
                  <span className="min-w-0"><strong className="truncate">{s.label}</strong> <span className="text-[var(--muted)]">in {s.module}</span></span>
                  <span className="shrink-0 font-semibold text-brand-700 dark:text-brand-300">{fmt(s.at)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(false)} disabled={busy} className="btn-outline btn-sm">Cancel</button>
              <button onClick={publish} disabled={busy} className="btn-primary btn-sm">{busy ? 'Publishing…' : <><Check width={14} height={14} /> Go Live</>}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
