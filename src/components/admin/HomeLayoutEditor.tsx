'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveHomeModule, toggleHomeModule, toggleHomeLock, reorderHomeModules, resetHomeLayout, setHomeModuleSource, setHomeModuleSpan } from '@/lib/actions';
import { ChevronUp, ChevronDown, Check, Eye, Lock, LockOpen, Grip } from '@/components/icons';

type Source = { value: string; label: string };
type Row = { id: string; label: string; description: string; enabled: boolean; locked: boolean; sources: Source[] | null; source: string | null; span: number };

// Width choices, in row-units. The homepage packs modules into rows of 3 units;
// on narrow screens everything collapses to full width regardless.
const WIDTHS: { value: number; label: string; hint: string }[] = [
  { value: 1, label: '⅓', hint: 'One-third — three fit across a row' },
  { value: 2, label: '⅔', hint: 'Two-thirds — pairs with a ⅓ module' },
  { value: 3, label: 'Full', hint: 'Full width — its own row' },
];

export default function HomeLayoutEditor({ modules }: { modules: Row[] }) {
  const [rows, setRows] = useState<Row[]>(modules);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => { setRows(modules); }, [modules]);
  const run = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const from = rows.findIndex((r) => r.id === dragId);
    const to = rows.findIndex((r) => r.id === targetId);
    if (from === -1 || to === -1 || rows[to].locked) { setDragId(null); setOverId(null); return; }
    const next = rows.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRows(next); // optimistic
    setDragId(null); setOverId(null);
    run(() => reorderHomeModules(next.map((r) => r.id)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4 dark:bg-brand-950/40">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">★</span>
        <div className="flex-1">
          <div className="font-semibold">Headline block <span className="ml-1 text-xs font-normal text-[var(--muted)]">(pinned — always first)</span></div>
          <div className="text-sm text-[var(--muted)]">Lead story + supporting headlines. This never moves.</div>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--muted)]">Drag the <Grip width={14} height={14} className="inline align-[-2px]" /> handle to reorder. Lock a module to freeze it in place.</p>

      <ol className="space-y-2">
        {rows.map((m, i) => (
          <li
            key={m.id}
            draggable={!m.locked && !pending}
            onDragStart={() => setDragId(m.id)}
            onDragEnter={() => setOverId(m.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(m.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            className={`flex items-center gap-3 rounded-xl border bg-[var(--card)] p-3 shadow-card transition
              ${overId === m.id && dragId !== m.id ? 'border-brand-500 ring-2 ring-brand-200' : 'border-[var(--border)]'}
              ${dragId === m.id ? 'opacity-40' : ''} ${m.enabled ? '' : 'opacity-60'} ${m.locked ? 'bg-[var(--bg-soft)]' : ''}`}
          >
            <span className={`shrink-0 ${m.locked ? 'cursor-not-allowed text-[var(--muted)]/40' : 'cursor-grab text-[var(--muted)] active:cursor-grabbing'}`} title={m.locked ? 'Locked' : 'Drag to reorder'}>
              <Grip width={18} height={18} />
            </span>

            {/* Up/down fallback (keyboard/mouse accessible) */}
            <div className="flex flex-col">
              <button disabled={pending || i === 0 || m.locked} onClick={() => run(() => moveHomeModule(m.id, 'up'))}
                className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] disabled:opacity-30" aria-label="Move up"><ChevronUp width={16} height={16} /></button>
              <button disabled={pending || i === rows.length - 1 || m.locked} onClick={() => run(() => moveHomeModule(m.id, 'down'))}
                className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] disabled:opacity-30" aria-label="Move down"><ChevronDown width={16} height={16} /></button>
            </div>

            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--bg-soft)] text-xs font-bold text-[var(--muted)]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-medium">{m.label}{m.locked && <Lock width={13} height={13} className="text-brand-600" />}</div>
              <div className="truncate text-sm text-[var(--muted)]">{m.description}</div>
              {m.sources && (
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Source:
                  <select
                    disabled={pending}
                    value={m.source ?? m.sources[0].value}
                    onChange={(e) => run(() => setHomeModuleSource(m.id, e.target.value))}
                    className="rounded-md border border-[var(--border)] bg-[var(--card-2)] px-2 py-1 text-xs font-semibold text-[var(--fg)]"
                  >
                    {m.sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              )}
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                Width:
                <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
                  {WIDTHS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      disabled={pending}
                      title={w.hint}
                      onClick={() => run(() => setHomeModuleSpan(m.id, w.value))}
                      className={`px-2 py-1 text-xs font-semibold transition ${m.span === w.value ? 'bg-brand-600 text-white' : 'bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--bg-soft)]'}`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button disabled={pending} onClick={() => run(() => toggleHomeLock(m.id))}
              className={`btn-sm ${m.locked ? 'btn-primary' : 'btn-outline'}`} title={m.locked ? 'Unlock' : 'Lock in place'}>
              {m.locked ? <Lock width={14} height={14} /> : <LockOpen width={14} height={14} />}
            </button>
            <button disabled={pending || m.locked} onClick={() => run(() => toggleHomeModule(m.id))}
              className={`btn-sm ${m.enabled ? 'btn-primary' : 'btn-outline'}`}>
              {m.enabled ? <><Check width={14} height={14} /> Visible</> : <><Eye width={14} height={14} /> Hidden</>}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Changes are saved as a draft — press <strong>Go Live</strong> above to publish.</p>
        <button disabled={pending} onClick={() => run(() => resetHomeLayout())} className="btn-outline btn-sm">Reset to default</button>
      </div>
    </div>
  );
}
