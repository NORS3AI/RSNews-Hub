'use client';
import { useMemo } from 'react';
import { publishFlags, describeTiming, hasBlockingFlag, type PublishInput, type AdEntry } from '@/lib/publishChecklist';
import { AlertTriangle, Check, X } from '@/components/icons';

export type ChecklistData = { input: PublishInput; ads: AdEntry[] };

// The pre-publish checklist modal, shared by the composer's Save flow and the
// Articles list's quick Publish. It takes the resolved article settings, computes
// the flags + timing, and blocks Confirm on a hard conflict (byline vs Author card).
export default function PublishChecklistModal({
  data, onCancel, onConfirm, confirmLabel = 'Confirm & publish', cancelLabel = 'Back to edit', busy = false,
}: {
  data: ChecklistData | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
}) {
  const flags = useMemo(() => (data ? publishFlags(data.input) : []), [data]);
  if (!data) return null;
  const input = data.input;
  const timing = describeTiming(input.publishedAt, input.now);
  const blocked = hasBlockingFlag(flags);
  const cats = [input.primaryCategory, ...input.extraCategories].filter(Boolean);

  const Field = ({ label, children, dim }: { label: string; children: React.ReactNode; dim?: boolean }) => (
    <div className="flex gap-3 py-1.5">
      <span className="w-28 shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className={`min-w-0 flex-1 text-sm ${dim ? 'text-[var(--muted)]' : ''}`}>{children}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Confirm publish">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Ready to publish?</h2>
          <button type="button" onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--fg)]" aria-label="Close"><X width={18} height={18} /></button>
        </div>

        {flags.length > 0 && (
          <div className="mb-4 space-y-2">
            {flags.map((f, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                f.level === 'block' ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
                : f.level === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-[var(--border)] bg-[var(--bg-soft)] text-[var(--fg)]'}`}>
                <AlertTriangle width={15} height={15} className={`mt-0.5 shrink-0 ${f.level === 'block' ? 'text-red-600' : f.level === 'warn' ? 'text-amber-600' : 'text-[var(--muted)]'}`} />
                <span>{f.level === 'block' ? <><b>Must fix — </b>{f.text}</> : f.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">
          <Field label="Title">{input.title || <span className="text-red-600">— required</span>}</Field>
          <Field label="Byline (top)" dim={!input.bylineName}>{input.bylineName || 'RS News Hub Team (house default)'}</Field>
          <Field label="Publish">{timing.label}</Field>
          <Field label="Categories" dim={cats.length === 0}>{cats.length ? cats.join(', ') : 'None'}</Field>
          <Field label="Genre" dim={!input.genre}>{input.genre || '—'}</Field>
          <Field label="Tags" dim={input.tags.length === 0}>{input.tags.length ? input.tags.join(', ') : 'None'}</Field>
          {input.connectedVendor && <Field label="Vendor">Locked to <b>{input.connectedVendor}</b></Field>}
          {(input.featured || input.pinned || input.breaking || input.sponsored) && (
            <Field label="Flags">
              {[input.breaking && 'Breaking', input.featured && 'Featured', input.pinned && 'Pinned', input.sponsored && 'Sponsored'].filter(Boolean).join(' · ')}
            </Field>
          )}
          {data.ads.length > 0 && (
            <Field label={`Ads (${data.ads.length})`}>
              <ul className="space-y-0.5">
                {data.ads.map((a) => (
                  <li key={a.index} className="text-[13px]">
                    <span className="text-[var(--muted)]">#{a.index}</span>{' '}
                    {a.kind === 'reserved'
                      ? <>Sponsor creative — <b>{a.label || 'unset'}</b></>
                      : (a.brand || a.label)
                        ? <>{a.size === 'rectangle' ? 'Rectangle' : 'Wide'} — pinned to <b>{a.label || a.brand}</b></>
                        : <>{a.size === 'rectangle' ? 'Rectangle' : 'Wide'} — <span className="text-[var(--muted)]">Auto (competitor-safe)</span></>}
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {blocked && <span className="mr-auto text-xs font-semibold text-red-600">Fix the conflict above to publish.</span>}
          <button type="button" className="btn-outline btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn-primary btn-sm disabled:opacity-50" onClick={onConfirm} disabled={blocked || busy}
            title={blocked ? 'Resolve the byline conflict first' : undefined}>
            <Check width={15} height={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
