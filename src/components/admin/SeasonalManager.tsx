'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSeasonalSchedule, setSeasonalEnabled, deleteSeasonalSchedule } from '@/lib/actions';
import { MONTH_NAMES, formatWindow, windowSpansYearEnd } from '@/lib/seasonal';
import type { SeasonalScheduleRow } from '@/lib/seasonalServer';
import { Plus, Check, X, Trash } from '@/components/icons';

type Mod = { id: string; name: string };
type Draft = { id?: string; label: string; moduleId: string; startMonth: number; startDay: number; endMonth: number; endDay: number; priority: number };

const BLANK: Draft = { label: '', moduleId: '', startMonth: 11, startDay: 1, endMonth: 1, endDay: 5, priority: 0 };

function MonthDay({ label, m, d, onM, onD }: { label: string; m: number; d: number; onM: (v: number) => void; onD: (v: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <select className="input" value={m} onChange={(e) => onM(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        <input type="number" min={1} max={31} className="input w-20" value={d} onChange={(e) => onD(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
      </div>
    </div>
  );
}

export default function SeasonalManager({ schedules, modules }: { schedules: SeasonalScheduleRow[]; modules: Mod[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, startSave] = useTransition();

  const openNew = () => setDraft(modules.length ? { ...BLANK, moduleId: modules[0].id } : { ...BLANK });
  const openEdit = (s: SeasonalScheduleRow) => setDraft({ id: s.id, label: s.label, moduleId: s.moduleId, startMonth: s.startMonth, startDay: s.startDay, endMonth: s.endMonth, endDay: s.endDay, priority: s.priority });
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = () => {
    if (!draft || !draft.label.trim() || !draft.moduleId) return;
    startSave(async () => { await saveSeasonalSchedule(draft); setDraft(null); router.refresh(); });
  };
  const toggle = (s: SeasonalScheduleRow, enabled: boolean) => startSave(async () => { await setSeasonalEnabled(s.id, enabled); router.refresh(); });
  const remove = (s: SeasonalScheduleRow) => {
    if (!confirm(`Delete the “${s.label}” seasonal placement? (The module itself is untouched.)`)) return;
    startSave(async () => { await deleteSeasonalSchedule(s.id); router.refresh(); });
  };

  if (modules.length === 0 && !draft) {
    return <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">You need a <b>published</b> Module Studio module first — build one in Module Studio, publish it, then schedule it here.</p>;
  }

  return (
    <div className="space-y-5">
      {draft ? (
        <div className="card space-y-3 p-4">
          <div>
            <label className="label" htmlFor="s-label">Name <span className="font-normal text-[var(--muted)]">(for your calendar)</span></label>
            <input id="s-label" className="input" value={draft.label} maxLength={120} autoFocus onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Holiday peak season" />
          </div>
          <div>
            <label className="label" htmlFor="s-mod">Feature this module</label>
            <select id="s-mod" className="input" value={draft.moduleId} onChange={(e) => set({ moduleId: e.target.value })}>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Tip: build the module with a <b>Collection</b> (category + tags + year) so it auto-fills seasonal stories.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MonthDay label="Starts" m={draft.startMonth} d={draft.startDay} onM={(v) => set({ startMonth: v })} onD={(v) => set({ startDay: v })} />
            <MonthDay label="Ends" m={draft.endMonth} d={draft.endDay} onM={(v) => set({ endMonth: v })} onD={(v) => set({ endDay: v })} />
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Goes live <b>{formatWindow(draft)}</b> every year{windowSpansYearEnd(draft) ? ' (carries into the new year)' : ''} and lifts off automatically.
          </p>
          <div>
            <label className="label" htmlFor="s-pri">Priority <span className="font-normal text-[var(--muted)]">(lower shows first)</span></label>
            <input id="s-pri" type="number" min={0} max={999} className="input w-24" value={draft.priority} onChange={(e) => set({ priority: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn-primary btn-sm" disabled={saving || !draft.label.trim() || !draft.moduleId} onClick={save}><Check width={14} height={14} /> {draft.id ? 'Save changes' : 'Add placement'}</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setDraft(null)}><X width={14} height={14} /> Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary btn-sm" onClick={openNew}><Plus width={14} height={14} /> New seasonal placement</button>
      )}

      <div className="space-y-2">
        {schedules.length === 0 && !draft && <p className="text-sm text-[var(--muted)]">No seasonal placements yet.</p>}
        {schedules.map((s) => (
          <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 ${s.enabled ? 'border-[var(--border)] bg-[var(--card)]' : 'border-dashed border-[var(--border)] opacity-70'}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.label}</span>
                {s.active && <span className="badge bg-emerald-100 text-[10px] uppercase tracking-wide text-emerald-800">Live now</span>}
                {!s.enabled && <span className="badge bg-amber-100 text-[10px] uppercase tracking-wide text-amber-800">Off</span>}
              </div>
              <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {s.moduleName ?? <span className="text-red-600">module missing</span>} · {formatWindow(s)} each year · priority {s.priority}
              </div>
            </div>
            <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
            <button type="button" className="btn-outline btn-sm" disabled={saving} onClick={() => toggle(s, !s.enabled)}>{s.enabled ? 'Disable' : 'Enable'}</button>
            <button type="button" className="btn-outline btn-sm text-red-600" disabled={saving} onClick={() => remove(s)}><Trash width={13} height={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
