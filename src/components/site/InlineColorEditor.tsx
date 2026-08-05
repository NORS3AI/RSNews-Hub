'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomModule from '@/components/site/CustomModule';
import { BLOCKS, isHexColor, type ModuleTree } from '@/lib/studio';
import { saveCustomModuleTree } from '@/lib/actions';
import { Edit, Check, X } from '@/components/icons';

// Admin-only "quick colors" editor shown on the live homepage for a custom
// module. Recolor the container + each block (RS-Mode only) with a live preview,
// then Save. Warns before leaving with unsaved changes.
export default function InlineColorEditor({ moduleId, name, initialTree }: { moduleId: string; name: string; initialTree: ModuleTree }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<ModuleTree>(initialTree);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [open, dirty]);

  const setContainer = (c: string | null) => { setTree((t) => ({ ...t, rsColor: c })); setDirty(true); };
  const setBlock = (id: string, c: string | null) => {
    setTree((t) => ({ ...t, children: t.children.map((b) => (b.id === id ? { ...b, rsColor: c } : b)) }));
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    try { await saveCustomModuleTree(moduleId, JSON.stringify(tree)); setDirty(false); setOpen(false); router.refresh(); }
    finally { setSaving(false); }
  }
  function close() {
    if (dirty && !confirm('Discard unsaved color changes?')) return;
    setTree(initialTree); setDirty(false); setOpen(false);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Quick colors (RS Mode)"
        className="absolute right-[86px] top-3 z-20 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold text-[var(--fg)] opacity-0 shadow-card transition hover:border-brand-400 hover:text-brand-600 focus:opacity-100 group-hover:opacity-100">
        <Edit width={13} height={13} /> Colors
      </button>

      {open && (
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
              {/* Live preview (forced into RS Mode so the colors show) */}
              <div className="overflow-auto bg-[var(--bg)] p-4">
                <div className="rs rounded-xl">
                  <CustomModule tree={tree} title={name} />
                </div>
              </div>
              {/* Controls */}
              <div className="overflow-auto border-t border-[var(--border)] bg-[var(--card)] p-4 sm:border-l sm:border-t-0">
                <Swatch label="Module background" value={tree.rsColor} onChange={setContainer} />
                <div className="my-2 border-t border-[var(--border)]" />
                {tree.children.map((b) => (
                  <Swatch key={b.id} label={BLOCKS[b.type]?.label ?? b.type} value={b.rsColor} onChange={(c) => setBlock(b.id, c)} />
                ))}
                {tree.children.length === 0 && <p className="text-sm text-[var(--muted)]">This module has no blocks.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Swatch({ label, value, onChange }: { label: string; value?: string | null; onChange: (c: string | null) => void }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-xs font-semibold text-[var(--muted)]">{label}</div>
      <div className="flex items-center gap-2">
        <input type="color" value={value && isHexColor(value) ? value : '#e97d34'} onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" />
        <input className="input flex-1 font-mono text-xs" value={value || ''} placeholder="theme default"
          onChange={(e) => { const v = e.target.value.trim(); onChange(isHexColor(v) ? v : v === '' ? null : value ?? null); }} />
        {value && <button onClick={() => onChange(null)} className="btn-outline btn-sm">Clear</button>}
      </div>
    </div>
  );
}
