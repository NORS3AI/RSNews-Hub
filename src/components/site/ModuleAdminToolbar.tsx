'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CustomModule from '@/components/site/CustomModule';
import RsColorPicker from '@/components/admin/studio/RsColorPicker';
import { BLOCKS, type ModuleTree } from '@/lib/studio';
import { saveCustomModuleTree, toggleHomeLockLive, toggleHomeSizeLockLive } from '@/lib/actions';
import { Edit, Check, X, Lock, LockOpen, ImageIcon } from '@/components/icons';

// The on-homepage admin control cluster for a single module. Appears on hover
// (top-right of the module), staff-only. Four controls:
//   • Edit    — open the module in its builder / the layout manager
//   • Size    — lock/unlock the module's width (⅓/⅔/full)
//   • Position— lock/unlock the module's slot (reorder)
//   • Colors  — quick RS-Mode recolor (custom modules only)
// The two locks publish immediately (live) so the toggle sticks in place; the
// editor's own controls stage via the draft + Go Live.
export default function ModuleAdminToolbar({
  id, href, editLabel, locked, sizeLocked, colorTree, name,
}: {
  id: string; href: string; editLabel: string;
  locked: boolean; sizeLocked: boolean;
  colorTree?: ModuleTree; name?: string; // present → custom module (colors enabled)
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [colorsOpen, setColorsOpen] = useState(false);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <>
      <div className="pointer-events-none absolute right-2 top-2 z-20 flex flex-wrap items-center justify-end gap-1.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <Link href={href} title={editLabel}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-bold text-[var(--fg)] shadow-card transition hover:border-brand-400 hover:text-brand-600">
          <Edit width={14} height={14} /> Edit
        </Link>

        <button type="button" disabled={pending} onClick={() => run(() => toggleHomeSizeLockLive(id))}
          title={sizeLocked ? 'Width is locked — click to unlock' : 'Lock this module’s width'}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-card transition disabled:opacity-50 ${sizeLocked ? 'border-brand-600 bg-brand-600 text-white' : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:border-brand-400 hover:text-brand-600'}`}>
          {sizeLocked ? <Lock width={14} height={14} /> : <LockOpen width={14} height={14} />} Size
        </button>

        <button type="button" disabled={pending} onClick={() => run(() => toggleHomeLockLive(id))}
          title={locked ? 'Position is locked — click to unlock' : 'Lock this module’s position'}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-card transition disabled:opacity-50 ${locked ? 'border-brand-600 bg-brand-600 text-white' : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:border-brand-400 hover:text-brand-600'}`}>
          {locked ? <Lock width={14} height={14} /> : <LockOpen width={14} height={14} />} Position
        </button>

        {colorTree && (
          <button type="button" onClick={() => setColorsOpen(true)} title="Quick colors (RS Mode)"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-bold text-[var(--fg)] shadow-card transition hover:border-brand-400 hover:text-brand-600">
            <ImageIcon width={14} height={14} /> Colors
          </button>
        )}
      </div>

      {colorsOpen && colorTree && (
        <ColorsModal moduleId={id.startsWith('custom:') ? id.slice('custom:'.length) : id} name={name ?? 'Module'} initialTree={colorTree} onClose={() => setColorsOpen(false)} onSaved={() => { setColorsOpen(false); router.refresh(); }} />
      )}
    </>
  );
}

function ColorsModal({ moduleId, name, initialTree, onClose, onSaved }: {
  moduleId: string; name: string; initialTree: ModuleTree; onClose: () => void; onSaved: () => void;
}) {
  const [tree, setTree] = useState<ModuleTree>(initialTree);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const setContainer = (c: string | null) => { setTree((t) => ({ ...t, rsColor: c })); setDirty(true); };
  const setBlock = (bid: string, c: string | null) => {
    setTree((t) => ({ ...t, children: t.children.map((b) => (b.id === bid ? { ...b, rsColor: c } : b)) }));
    setDirty(true);
  };
  async function save() {
    setSaving(true);
    try { await saveCustomModuleTree(moduleId, JSON.stringify(tree)); setDirty(false); onSaved(); }
    finally { setSaving(false); }
  }
  function close() {
    if (dirty && !confirm('Discard unsaved color changes?')) return;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <div className="font-bold">Colors — {name} <span className="ml-1 text-xs font-normal text-[var(--muted)]">RS Mode only</span></div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs font-semibold text-amber-600">Unsaved</span>}
            <button onClick={save} disabled={saving || !dirty} className="btn-primary btn-sm">{saving ? 'Saving…' : <><Check width={14} height={14} /> Save</>}</button>
            <button onClick={close} className="btn-ghost h-8 w-8 !px-0" aria-label="Close"><X width={16} height={16} /></button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden sm:grid-cols-[1fr_260px]">
          <div className="overflow-auto bg-[var(--bg)] p-4">
            <div className="rs rounded-xl">
              <CustomModule tree={tree} title={name} />
            </div>
          </div>
          <div className="overflow-auto border-t border-[var(--border)] bg-[var(--card)] p-4 sm:border-l sm:border-t-0">
            <Labeled label="Module background"><RsColorPicker value={tree.rsColor} onChange={setContainer} /></Labeled>
            <div className="my-3 border-t border-[var(--border)]" />
            {tree.children.map((b) => (
              <Labeled key={b.id} label={b.label || BLOCKS[b.type]?.label || b.type}><RsColorPicker value={b.rsColor} onChange={(c) => setBlock(b.id, c)} /></Labeled>
            ))}
            {tree.children.length === 0 && <p className="text-sm text-[var(--muted)]">This module has no elements.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-semibold text-[var(--muted)]">{label}</div>
      {children}
    </div>
  );
}
