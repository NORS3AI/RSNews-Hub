'use client';
import { useState } from 'react';
import { Plus, Trash } from '@/components/icons';

// Editable poll options for the update form. Each row keeps its existing option
// id (blank for a new one) in a hidden field so the server can edit labels in
// place — preserving votes — instead of wiping and recreating. Options that
// already have votes can be relabelled but not removed (their tally is real).
type Row = { id: string; label: string; votes: number };

export default function PollOptionsEditor({ options }: { options: Row[] }) {
  const [rows, setRows] = useState<Row[]>(options.length ? options : [{ id: '', label: '', votes: 0 }]);

  const setLabel = (i: number, label: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, label } : row)));
  const add = () => setRows((r) => (r.length < 8 ? [...r, { id: '', label: '', votes: 0 }] : r));
  const remove = (i: number) => setRows((r) => (r[i].votes > 0 ? r : r.filter((_, idx) => idx !== i)));

  return (
    <div className="space-y-2">
      <label className="label">Options (2–8) — labels are editable; votes are kept</label>
      {rows.map((row, i) => (
        <div key={row.id || `new-${i}`} className="flex items-center gap-2">
          <input type="hidden" name="optId" value={row.id} />
          <input
            name="optLabel" value={row.label} onChange={(e) => setLabel(i, e.target.value)}
            required maxLength={200} className="input flex-1" placeholder={`Option ${i + 1}`} />
          {row.votes > 0 ? (
            <span title="Has votes — can be relabelled but not removed" className="shrink-0 whitespace-nowrap px-1 text-xs text-[var(--muted)]">{row.votes} vote{row.votes === 1 ? '' : 's'}</span>
          ) : (
            <button type="button" onClick={() => remove(i)} disabled={rows.length <= 2}
              title={rows.length <= 2 ? 'A poll needs at least 2 options' : 'Remove option'}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:text-red-600 disabled:opacity-40">
              <Trash width={15} height={15} />
            </button>
          )}
        </div>
      ))}
      {rows.length < 8 && (
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          <Plus width={14} height={14} /> Add option
        </button>
      )}
    </div>
  );
}
