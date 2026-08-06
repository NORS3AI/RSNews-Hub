'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BLOCKS, BLOCK_GROUPS, BLOCK_IDS, blocksInGroup, SHAPES, SHAPE_IDS, makeBlock, blockChain, MAX_BLOCKS, MAX_FALLBACKS,
  type ModuleTree, type Block, type BlockType, type Shape,
} from '@/lib/studio';
import CustomModule, { BlockView, shapeInnerClass, childWidthClass, shapeContainerClass, rsStyle } from '@/components/site/CustomModule';
import { saveCustomModuleTree, renameCustomModule, setCustomModulePublished } from '@/lib/actions';
import EntityPicker from '@/components/admin/studio/EntityPicker';
import RsColorPicker from '@/components/admin/studio/RsColorPicker';
import { ArrowLeft, Plus, Grip, Trash, Copy, Check, ChevronDown, ChevronRight, Eye, X } from '@/components/icons';

function newId(): string {
  try { return 'b' + crypto.randomUUID().slice(0, 8); } catch { return 'b' + Date.now().toString(36); }
}

type DragState = { kind: 'palette'; type: BlockType; preset?: Record<string, unknown> } | { kind: 'move'; index: number } | null;

// Categories are shared with the deeply-nested inspector fields (category
// source + heading "See all" link) without threading props through every level.
export type CatOption = { name: string; slug: string };
const CategoriesContext = createContext<CatOption[]>([]);
const useCategories = () => useContext(CategoriesContext);

// Ad sizes shown directly in the palette so you drop the right shape for the
// slot (e.g. Square fits a sidebar; Leaderboard is a wide banner).
const AD_VARIANTS: { label: string; format: string }[] = [
  { label: 'Ad — rectangle', format: 'rectangle' },
  { label: 'Ad — square', format: 'square' },
  { label: 'Ad — vertical', format: 'vertical' },
  { label: 'Ad — leaderboard', format: 'leaderboard' },
  { label: 'Ad — video', format: 'video' },
];

export default function StudioEditor({
  id, name: initialName, published, initialTree, categories = [],
}: { id: string; name: string; published: boolean; initialTree: ModuleTree; categories?: CatOption[] }) {
  const router = useRouter();
  const [tree, setTree] = useState<ModuleTree>(initialTree);
  const [name, setName] = useState(initialName);
  const [pub, setPub] = useState(published);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // The public homepage can be viewed in Light, Dark, or RS mode, so the builder
  // previews the module in whichever the admin picks (per-element colors are
  // RS-only, so RS is where those show). Defaults to Light — the common view.
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | 'rs'>('light');
  const [livePreview, setLivePreview] = useState(false);
  const previewClass = previewMode === 'rs' ? 'rs' : previewMode === 'dark' ? 'dark' : '';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [saving, startSave] = useTransition();
  const drag = useRef<DragState>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [past, setPast] = useState<ModuleTree[]>([]);
  const [future, setFuture] = useState<ModuleTree[]>([]);
  // Permutation preview: which rung of each slot's priority stack to show on the
  // canvas, so the admin can eyeball "if no poll → the ad; if no ad → the
  // article" before it ever happens live. Keyed by block id; default 0 (primary).
  const [rungPreview, setRungPreview] = useState<Record<string, number>>({});

  const selectedBlock = useMemo(() => tree.children.find((b) => b.id === selected) ?? null, [tree, selected]);

  // Warn before leaving with unsaved changes (browser nav / refresh / close).
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  /* ---- tree mutations (with undo/redo history) ---- */
  const mutate = (fn: (t: ModuleTree) => ModuleTree) => {
    setPast((p) => [...p.slice(-49), tree]); // cap history
    setFuture([]);
    setTree(fn(structuredClone(tree)));
    setDirty(true);
  };
  function undo() {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [tree, ...f]);
      setTree(p[p.length - 1]);
      setDirty(true);
      setSelected(null);
      return p.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, tree]);
      setTree(f[0]);
      setDirty(true);
      return f.slice(1);
    });
  }

  function addBlock(type: BlockType, at?: number, preset?: Record<string, unknown>) {
    if (tree.children.length >= MAX_BLOCKS) return;
    const block = makeBlock(type, newId());
    if (preset) block.settings = { ...block.settings, ...preset };
    mutate((t) => {
      const i = at ?? t.children.length;
      t.children.splice(i, 0, block);
      return t;
    });
    setSelected(block.id);
  }
  function moveBlock(from: number, to: number) {
    if (from === to) return;
    mutate((t) => { const [m] = t.children.splice(from, 1); t.children.splice(to > from ? to - 1 : to, 0, m); return t; });
  }
  function removeBlock(bid: string) {
    mutate((t) => { t.children = t.children.filter((b) => b.id !== bid); return t; });
    setSelected((s) => (s === bid ? null : s));
  }
  function duplicateBlock(bid: string) {
    mutate((t) => {
      const i = t.children.findIndex((b) => b.id === bid);
      if (i === -1) return t;
      const copy: Block = structuredClone(t.children[i]);
      copy.id = newId();
      t.children.splice(i + 1, 0, copy);
      return t;
    });
  }
  const setShape = (shape: Shape) => mutate((t) => { t.shape = shape; return t; });
  const setContainerColor = (c: string | null) => mutate((t) => { t.rsColor = c; return t; });
  const setExpireDays = (d: number) => mutate((t) => { t.expireDays = d > 0 ? d : 0; return t; });
  function patchSelected(patch: Partial<Block> | { settings: Record<string, unknown> }) {
    if (!selectedBlock) return;
    mutate((t) => {
      const b = t.children.find((x) => x.id === selectedBlock.id);
      if (!b) return t;
      if ('settings' in patch && patch.settings) b.settings = { ...b.settings, ...patch.settings };
      if ('rsColor' in patch) b.rsColor = (patch as any).rsColor;
      if ('label' in patch) b.label = ((patch as any).label as string) || undefined;
      if ('fallbacks' in patch) {
        const fb = (patch as any).fallbacks as Block[] | undefined;
        b.fallbacks = fb && fb.length ? fb : undefined;
      }
      if ('startAt' in patch) b.startAt = (patch as any).startAt || undefined;
      if ('endAt' in patch) b.endAt = (patch as any).endAt || undefined;
      if ('requirement' in patch) b.requirement = (patch as any).requirement || undefined;
      if ('gateMode' in patch) b.gateMode = (patch as any).gateMode;
      return t;
    });
  }

  /* ---- drag & drop ---- */
  function onDropAt(index: number) {
    const d = drag.current;
    setOverIndex(null);
    drag.current = null;
    if (!d) return;
    if (d.kind === 'palette') addBlock(d.type, index, d.preset);
    else moveBlock(d.index, index);
  }

  /* ---- persistence ---- */
  function save() {
    startSave(async () => {
      await saveCustomModuleTree(id, JSON.stringify(tree));
      setDirty(false);
      router.refresh();
    });
  }
  function saveName() {
    const n = name.trim();
    if (!n || n === initialName) return;
    startSave(async () => { await renameCustomModule(id, n); router.refresh(); });
  }
  function togglePublish() {
    // Save any pending edits first so we never publish a stale tree.
    startSave(async () => {
      if (dirty) { await saveCustomModuleTree(id, JSON.stringify(tree)); setDirty(false); }
      const next = !pub;
      await setCustomModulePublished(id, next);
      setPub(next);
      router.refresh();
    });
  }

  return (
    <CategoriesContext.Provider value={categories}>
    <div className="mx-auto max-w-6xl">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/studio" className="btn-outline btn-sm"><ArrowLeft width={14} height={14} /> Studio</Link>
        <input
          className="input max-w-xs flex-1 font-semibold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          aria-label="Module name"
        />
        {pub
          ? <span className="badge bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">On homepage</span>
          : <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Draft</span>}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={undo} disabled={!past.length} className="btn-outline btn-sm !px-2" title="Undo" aria-label="Undo">↶</button>
          <button onClick={redo} disabled={!future.length} className="btn-outline btn-sm !px-2" title="Redo" aria-label="Redo">↷</button>
          {dirty && <span className="flex items-center gap-1.5 text-sm text-amber-600"><span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved</span>}
          <button onClick={save} disabled={saving || !dirty} className="btn-outline btn-sm" title="Save your changes">
            {saving ? 'Saving…' : <><Check width={14} height={14} /> {pub ? 'Save' : 'Save draft'}</>}
          </button>
          {!pub && (
            <button onClick={togglePublish} disabled={saving} className="btn-primary btn-sm" title="Publish and stage this module on the homepage">
              Push to homepage
            </button>
          )}
        </div>
      </div>

      {/* Draft nudge: an unpublished module isn't on the homepage yet. To take a
          published module back off, use Homepage layout (not the Studio). */}
      {!pub && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          This is a <strong>draft</strong> — save it for later, or <strong>Push to homepage</strong> when ready (then Go Live from Homepage layout).
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_300px]">
        {/* ---- Palette ---- */}
        <aside className="space-y-4">
          <Panel title="Shape">
            <div className="grid grid-cols-2 gap-1.5">
              {SHAPE_IDS.map((s) => (
                <button key={s} onClick={() => setShape(s)}
                  className={`rounded-lg border p-2 text-xs font-semibold ${tree.shape === s ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}
                  title={SHAPES[s].description}>
                  {SHAPES[s].label}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Add elements">
            <div className="space-y-2">
              {BLOCK_GROUPS.map((g) => {
                const open = openGroups[g] !== false;
                return (
                  <div key={g}>
                    <button onClick={() => setOpenGroups((o) => ({ ...o, [g]: !open }))}
                      className="flex w-full items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[var(--muted)] hover:text-[var(--fg)]">
                      {open ? <ChevronDown width={12} height={12} /> : <ChevronRight width={12} height={12} />} {g}
                    </button>
                    {open && (
                      <div className="mt-1 space-y-1.5">
                        {blocksInGroup(g).flatMap((t) => {
                          // The Ad element expands into its sizes so you can drop the right shape.
                          const entries = t === 'ad'
                            ? AD_VARIANTS.map((v) => ({ key: `ad:${v.format}`, type: 'ad' as BlockType, label: v.label, preset: { format: v.format }, desc: `${v.label} — cycles your live ad library` }))
                            : [{ key: t, type: t, label: BLOCKS[t].label, preset: undefined as Record<string, unknown> | undefined, desc: BLOCKS[t].description }];
                          return entries.map((e) => (
                            <button key={e.key}
                              draggable
                              onDragStart={() => { drag.current = { kind: 'palette', type: e.type, preset: e.preset }; }}
                              onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                              onClick={() => addBlock(e.type, undefined, e.preset)}
                              disabled={tree.children.length >= MAX_BLOCKS}
                              className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-2 text-left text-xs font-semibold hover:border-brand-400 disabled:opacity-40"
                              title={e.desc}>
                              <Plus width={13} height={13} className="shrink-0 text-brand-600" /> {e.label}
                            </button>
                          ));
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-tight text-[var(--muted)]">Click to append, or drag onto the canvas. {tree.children.length}/{MAX_BLOCKS}</p>
          </Panel>
        </aside>

        {/* ---- Canvas ---- */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Canvas</span>
            <div className="flex items-center gap-2">
              {/* Preview the module in the same three themes a reader can pick. */}
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] text-xs font-semibold">
                {(['light', 'dark', 'rs'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setPreviewMode(m)}
                    className={`px-2.5 py-1 capitalize transition-colors ${previewMode === m ? 'bg-brand-600 text-white' : 'bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
                    {m === 'rs' ? 'RS' : m}
                  </button>
                ))}
              </div>
              {/* WYSIWYG at homepage width — the canvas is narrower than the live
                  column, so this shows the true relaxed layout. */}
              <button type="button" onClick={() => setLivePreview(true)}
                className="btn-outline btn-sm" title="See it at full homepage width">
                <Eye width={14} height={14} /> Preview
              </button>
            </div>
          </div>
          <div className={`mx-auto w-full max-w-4xl rounded-2xl ${previewClass}`}>
            <section className={`module studio-fill mx-auto min-h-[200px] ${shapeContainerClass(tree.shape)}`} style={rsStyle(tree.rsColor)}
              onClick={() => setSelected(null)}>
              {tree.children.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setOverIndex(0); }}
                  onDrop={() => onDropAt(0)}
                  className={`grid min-h-[160px] place-items-center rounded-xl border-2 border-dashed p-6 text-center text-sm text-[var(--muted)] ${overIndex === 0 ? 'border-brand-500 bg-brand-50/50' : 'border-[var(--border)]'}`}>
                  Drag an element here, or click one in the palette.
                </div>
              ) : (
                <div className={shapeInnerClass(tree.shape)}>
                  {tree.children.map((b, i) => {
                    const chain = blockChain(b);
                    const rung = Math.min(rungPreview[b.id] ?? 0, chain.length - 1);
                    return (
                    <div key={b.id} className={childWidthClass(tree.shape)}
                      onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
                      onDrop={(e) => { e.stopPropagation(); onDropAt(i); }}>
                      <BlockFrame
                        selected={selected === b.id}
                        over={overIndex === i}
                        onSelect={(e) => { e.stopPropagation(); setSelected(b.id); }}
                        onDragStart={() => { drag.current = { kind: 'move', index: i }; }}
                        onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                        onRemove={(e) => { e.stopPropagation(); removeBlock(b.id); }}
                        onDuplicate={(e) => { e.stopPropagation(); duplicateBlock(b.id); }}
                        label={BLOCKS[b.type].label}
                        chain={chain}
                        rung={rung}
                        onRung={(k) => setRungPreview((r) => ({ ...r, [b.id]: k }))}
                        scheduled={!!(b.startAt || b.endAt)}
                        gateLabel={b.requirement ? (AUDIENCES.find((a) => a.value === b.requirement)?.label ?? b.requirement) : undefined}
                      >
                        <BlockView block={chain[rung]} />
                      </BlockFrame>
                    </div>
                  ); })}
                  {/* trailing append zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setOverIndex(tree.children.length); }}
                    onDrop={(e) => { e.stopPropagation(); onDropAt(tree.children.length); }}
                    className={`${childWidthClass(tree.shape)} grid min-h-[44px] place-items-center rounded-lg border border-dashed text-xs text-[var(--muted)] ${overIndex === tree.children.length ? 'border-brand-500 bg-brand-50/50' : 'border-transparent'}`}>
                    {overIndex === tree.children.length ? 'Drop here' : ''}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ---- Inspector ---- */}
        <aside>
          {selectedBlock
            ? <BlockInspector block={selectedBlock} onPatch={patchSelected} onRemove={() => removeBlock(selectedBlock.id)} onDuplicate={() => duplicateBlock(selectedBlock.id)} />
            : <ModuleInspector tree={tree} onShape={setShape} onColor={setContainerColor} onExpireDays={setExpireDays} />}
        </aside>
      </div>

      {/* ---- Full-width preview overlay: exactly how the module lands on the
           homepage column, in the chosen theme. Closes the WYSIWYG gap the
           narrower canvas can't. ---- */}
      {livePreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 sm:p-8" onClick={() => setLivePreview(false)}>
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Homepage preview — {previewMode === 'rs' ? 'RS' : previewMode} mode</span>
              <div className="flex items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] text-xs font-semibold">
                  {(['light', 'dark', 'rs'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setPreviewMode(m)}
                      className={`px-2.5 py-1 capitalize ${previewMode === m ? 'bg-brand-600 text-white' : 'bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>
                      {m === 'rs' ? 'RS' : m}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setLivePreview(false)} className="btn-ghost btn-sm !px-2" aria-label="Close preview"><X width={16} height={16} /></button>
              </div>
            </div>
            {/* Mirror the homepage main column: full width, its padding + spacing. */}
            <div className={`flex-1 overflow-y-auto ${previewClass}`}>
              <div className="min-h-full bg-[var(--bg)] px-4 py-6 lg:px-7 lg:py-8">
                <CustomModule tree={tree} title={name} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </CategoriesContext.Provider>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-card">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">{title}</div>
      {children}
    </div>
  );
}

function BlockFrame({ selected, over, label, children, onSelect, onDragStart, onDragEnd, onRemove, onDuplicate, chain, rung, onRung, scheduled, gateLabel }: {
  selected: boolean; over: boolean; label: string; children: React.ReactNode;
  onSelect: (e: React.MouseEvent) => void; onDragStart: () => void; onDragEnd: () => void;
  onRemove: (e: React.MouseEvent) => void; onDuplicate: (e: React.MouseEvent) => void;
  chain?: Block[]; rung?: number; onRung?: (k: number) => void; scheduled?: boolean; gateLabel?: string;
}) {
  const hasFallbacks = !!chain && chain.length > 1;
  return (
    <div onClick={onSelect}
      className={`group relative rounded-xl transition ${selected ? 'ring-2 ring-brand-500' : 'ring-1 ring-transparent hover:ring-brand-300'} ${over ? 'outline outline-2 outline-brand-500' : ''}`}>
      {/* toolbar */}
      <div className="absolute -top-2.5 right-2 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <span draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
          className="grid h-6 w-6 cursor-grab place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-card active:cursor-grabbing" title="Drag to reorder"><Grip width={13} height={13} /></span>
        <button onClick={onDuplicate} className="grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-card hover:text-[var(--fg)]" title="Duplicate"><Copy width={13} height={13} /></button>
        <button onClick={onRemove} className="grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-red-600 shadow-card hover:bg-red-50" title="Remove"><Trash width={13} height={13} /></button>
      </div>
      {selected && <span className="absolute -top-2.5 left-2 z-10 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{label}</span>}
      {/* the block preview (non-interactive) */}
      <div className="pointer-events-none">{children}</div>
      {/* Permutation stepper + schedule marker. The stepper walks the priority
          stack to preview each fallback state ("if no poll → ad → article"). */}
      {(hasFallbacks || scheduled || gateLabel) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card-2)] px-1.5 py-1 text-[10px]" onClick={(e) => e.stopPropagation()}>
          {scheduled && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="This element has a schedule window">⏱ Scheduled</span>}
          {gateLabel && <span className="rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" title="Audience-gated element">🔒 {gateLabel}</span>}
          {hasFallbacks && <span className="font-bold uppercase tracking-wide text-[var(--muted)]">If empty:</span>}
          {hasFallbacks && chain!.map((r, k) => (
            <button key={k} type="button" onClick={() => onRung?.(k)}
              className={`rounded px-1.5 py-0.5 font-semibold transition ${k === rung ? 'bg-brand-600 text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--fg)]'}`}
              title={k === 0 ? 'Your primary choice' : `Fallback ${k}`}>
              {k > 0 && <span className="opacity-60">→ </span>}{BLOCKS[r.type].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Inspectors ---- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-3 block"><span className="label !mb-1 text-xs">{label}</span>{children}</label>;
}

function InspectorShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-card lg:sticky lg:top-4">
      <div className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--muted)]">{title}</div>
      {children}
    </div>
  );
}

function ModuleInspector({ tree, onShape, onColor, onExpireDays }: { tree: ModuleTree; onShape: (s: Shape) => void; onColor: (c: string | null) => void; onExpireDays: (d: number) => void }) {
  return (
    <InspectorShell title="Module">
      <Field label="Shape">
        <select className="input" value={tree.shape} onChange={(e) => onShape(e.target.value as Shape)}>
          {SHAPE_IDS.map((s) => <option key={s} value={s}>{SHAPES[s].label}</option>)}
        </select>
      </Field>
      <Field label="Background"><RsColorPicker value={tree.rsColor} onChange={onColor} /></Field>
      <Field label="Auto-remove after (days)">
        <input type="number" min={0} className="input" value={Number(tree.expireDays) || 0} onChange={(e) => onExpireDays(Math.max(0, Number(e.target.value) || 0))} />
        <p className="mt-1 text-[11px] text-[var(--muted)]">0 = never. Invisible timer starts when you publish; the module drops off the homepage when it elapses (logged in the activity log).</p>
      </Field>
      <p className="text-xs text-[var(--muted)]">Select an element on the canvas to edit its settings. {tree.children.length} element{tree.children.length === 1 ? '' : 's'} in this module.</p>
    </InspectorShell>
  );
}

function BlockInspector({ block, onPatch, onRemove, onDuplicate }: {
  block: Block; onPatch: (p: any) => void; onRemove: () => void; onDuplicate: () => void;
}) {
  const s = block.settings;
  const set = (k: string, v: unknown) => onPatch({ settings: { [k]: v } });
  const [tab, setTab] = useState<'content' | 'style' | 'fallback' | 'schedule' | 'access'>('content');
  const fbCount = block.fallbacks?.length ?? 0;
  const scheduled = !!(block.startAt || block.endAt);
  const gated = !!block.requirement;
  const TABS: { id: 'content' | 'style' | 'fallback' | 'schedule' | 'access'; label: string }[] = [
    { id: 'content', label: 'Content' }, { id: 'style', label: 'Style' },
    { id: 'fallback', label: fbCount ? `If empty (${fbCount})` : 'If empty' },
    { id: 'schedule', label: scheduled ? 'Schedule •' : 'Schedule' },
    { id: 'access', label: gated ? 'Access •' : 'Access' },
  ];
  return (
    <InspectorShell title={BLOCKS[block.type].label}>
      <div className="mb-3 flex flex-wrap gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-0.5 text-xs font-bold">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-md px-2.5 py-1 ${tab === t.id ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>{t.label}</button>
        ))}
      </div>

      <div className={tab === 'content' ? '' : 'hidden'}>
      {(block.type === 'article' || block.type === 'article-image' || block.type === 'article-headline') && (
        <>
          <ArticleFillFields s={s} set={set} />
          {(block.type === 'article' || block.type === 'article-image') && (
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.showDek !== false} onChange={(e) => set('showDek', e.target.checked)} /> Show standfirst (dek)</label>
          )}
          {block.type === 'article-image' && (
            <Field label="Image position">
              <select className="input" value={String(s.imagePosition ?? 'top')} onChange={(e) => set('imagePosition', e.target.value)}>
                <option value="top">Top</option>
                <option value="left">Left</option>
              </select>
            </Field>
          )}
        </>
      )}
      {block.type === 'ad' && (
        <>
          <Field label="Ad format">
            <select className="input" value={String(s.format ?? 'rectangle')} onChange={(e) => set('format', e.target.value)}>
              <option value="rectangle">Rectangle (medium)</option>
              <option value="square">Square (fits a sidebar)</option>
              <option value="vertical">Vertical (skyscraper)</option>
              <option value="leaderboard">Leaderboard (wide banner)</option>
              <option value="video">Video</option>
            </select>
          </Field>
          <Field label="Limit to advertiser (optional)">
            <input className="input" value={String(s.vendor ?? '')} onChange={(e) => set('vendor', e.target.value)} placeholder="e.g. PackageHub" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Locks this slot to one advertiser&apos;s creatives — a sponsor spotlight. Leave blank to rotate all live ads. If that advertiser has no live ad, the slot falls through to your fallback.</p>
          </Field>
        </>
      )}
      {block.type === 'image' && (
        <>
          <Field label="Image URL"><input className="input" value={String(s.url ?? '')} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
          <Field label="Alt text"><input className="input" value={String(s.alt ?? '')} onChange={(e) => set('alt', e.target.value)} placeholder="Describe the image" /></Field>
          <Field label={`Width — ${Number(s.widthPct ?? 100)}% of the module`}>
            <input type="range" min={10} max={200} step={5} value={Number(s.widthPct ?? 100)} onChange={(e) => set('widthPct', Number(e.target.value))} className="w-full accent-brand-600" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Over 100% intentionally overflows the module edges.</p>
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.radius !== false} onChange={(e) => set('radius', e.target.checked)} /> Rounded corners</label>
        </>
      )}
      {block.type === 'quiz' && (
        <>
          <Field label="Quiz"><EntityPicker value={String(s.quizId ?? '')} onChange={(id) => set('quizId', id)} endpoint="/api/admin/quizzes/search" placeholder="Search quizzes…" /></Field>
          <p className="-mt-1 mb-3 text-[11px] text-[var(--muted)]">Leave empty to show the current active quiz. Build quizzes under <strong>Pop Quiz</strong>; their open/close timer is set there.</p>
        </>
      )}
      {block.type === 'poll' && (
        <>
          <Field label="Poll"><EntityPicker value={String(s.pollId ?? '')} onChange={(id) => set('pollId', id)} endpoint="/api/admin/polls/search" placeholder="Search polls…" /></Field>
          <Field label="Results chart">
            <select className="input" value={String(s.chart ?? 'bar')} onChange={(e) => set('chart', e.target.value)}>
              <option value="bar">Bars</option>
              <option value="pie">Pie</option>
            </select>
          </Field>
          <p className="-mt-1 mb-3 text-[11px] text-[var(--muted)]">Create &amp; time polls under <strong>Polls</strong>; the countdown shows publicly. Or use <strong>Add to homepage</strong> there for a one-click post.</p>
        </>
      )}
      {block.type === 'heading' && (
        <>
          <Field label="Text"><input className="input" value={String(s.text ?? '')} onChange={(e) => set('text', e.target.value)} /></Field>
          <Field label="Level">
            <select className="input" value={Number(s.level ?? 2)} onChange={(e) => set('level', Number(e.target.value))}>
              <option value={2}>Large (H2)</option>
              <option value={3}>Small (H3)</option>
            </select>
          </Field>
          <HeadingSeeAllFields s={s} set={set} />
        </>
      )}
      {block.type === 'text' && (
        <Field label="Body"><textarea className="input min-h-[120px]" value={String(s.body ?? '')} onChange={(e) => set('body', e.target.value)} /></Field>
      )}
      </div>

      <div className={tab === 'style' ? '' : 'hidden'}>
        <Field label="Label (small header)"><input className="input" value={String(block.label ?? '')} onChange={(e) => onPatch({ label: e.target.value })} placeholder="optional, e.g. FEATURED" /></Field>
        <Field label="Background"><RsColorPicker value={block.rsColor} onChange={(c) => onPatch({ rsColor: c })} /></Field>
      </div>

      <div className={tab === 'fallback' ? '' : 'hidden'}>
        <FallbackEditor block={block} onPatch={onPatch} />
      </div>

      <div className={tab === 'schedule' ? '' : 'hidden'}>
        <ScheduleEditor block={block} onPatch={onPatch} />
      </div>

      <div className={tab === 'access' ? '' : 'hidden'}>
        <AccessEditor block={block} onPatch={onPatch} />
      </div>

      <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-3">
        <button onClick={onDuplicate} className="btn-outline btn-sm flex-1"><Copy width={13} height={13} /> Duplicate</button>
        <button onClick={onRemove} className="btn-danger btn-sm flex-1"><Trash width={13} height={13} /> Remove</button>
      </div>
    </InspectorShell>
  );
}

// Heading "See all →" link: point the header at a category's archive.
function HeadingSeeAllFields({ s, set }: { s: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const categories = useCategories();
  const cat = String(s.seeAllCat ?? '');
  return (
    <>
      <Field label="“See all” link">
        <select className="input" value={cat} onChange={(e) => set('seeAllCat', e.target.value)}>
          <option value="">None</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>Archive: {c.name}</option>)}
        </select>
      </Field>
      {cat && (
        <Field label="Link text (optional)">
          <input className="input" value={String(s.seeAllText ?? '')} onChange={(e) => set('seeAllText', e.target.value)} placeholder="See all" />
        </Field>
      )}
    </>
  );
}

function ArticleFillFields({ s, set }: { s: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const mode = String(s.mode ?? 'auto');
  const categories = useCategories();
  return (
    <>
      <Field label="Fill with">
        <select className="input" value={mode} onChange={(e) => set('mode', e.target.value)}>
          <option value="auto">Auto — from a pool</option>
          <option value="category">By category</option>
          <option value="tag">By tag / keyword</option>
          <option value="year">By year (throwback)</option>
          <option value="pick">Pick a specific article</option>
        </select>
      </Field>
      {mode === 'auto' && (
        <Field label="Source">
          <select className="input" value={String(s.source ?? 'latest')} onChange={(e) => set('source', e.target.value)}>
            <option value="featured">Featured</option>
            <option value="latest">Latest</option>
            <option value="trending">Trending</option>
          </select>
        </Field>
      )}
      {mode === 'category' && (
        <Field label="Category">
          <select className="input" value={String(s.categorySlug ?? '')} onChange={(e) => set('categorySlug', e.target.value)}>
            <option value="">Choose a category…</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {mode === 'tag' && (
        <Field label="Tag or keyword"><input className="input" value={String(s.tag ?? '')} onChange={(e) => set('tag', e.target.value)} placeholder="e.g. logistics" /></Field>
      )}
      {mode === 'year' && (
        <Field label="Year"><input type="number" min={1990} max={2100} className="input" value={Number(s.year) || ''} onChange={(e) => set('year', Number(e.target.value))} placeholder="e.g. 2019" /></Field>
      )}
      {mode === 'pick' && (
        <Field label="Article"><EntityPicker value={String(s.articleId ?? '')} onChange={(id) => set('articleId', id)} endpoint="/api/admin/articles/search" placeholder="Search articles…" /></Field>
      )}
    </>
  );
}

/* ---- Fallback chain: the slot's priority stack ---- */

function FallbackEditor({ block, onPatch }: { block: Block; onPatch: (p: any) => void }) {
  const fbs = block.fallbacks ?? [];
  const commit = (next: Block[]) => onPatch({ fallbacks: next });
  const add = () => { if (fbs.length < MAX_FALLBACKS) commit([...fbs, makeBlock('ad', newId())]); };
  const update = (i: number, b: Block) => commit(fbs.map((f, k) => (k === i ? b : f)));
  const remove = (i: number) => commit(fbs.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fbs.length) return;
    const next = fbs.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
        If <strong>{BLOCKS[block.type].label}</strong> has nothing to show right now, the slot falls through these in order and shows the first that can fill — so it&apos;s never empty and never changes size. Put a can&apos;t-fail type last (an <strong>Ad</strong>, or an <strong>Auto/Latest</strong> article).
      </p>
      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-2.5 py-1.5 text-xs">
        <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">1</span>
        <strong>{BLOCKS[block.type].label}</strong> <span className="text-[var(--muted)]">— your primary choice</span>
      </div>
      <div className="space-y-2">
        {fbs.map((f, i) => (
          <FallbackRow key={f.id} index={i} count={fbs.length} block={f}
            onType={(t) => update(i, makeBlock(t, f.id))}
            onSet={(k, v) => update(i, { ...f, settings: { ...f.settings, [k]: v } })}
            onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => remove(i)} />
        ))}
      </div>
      <button type="button" onClick={add} disabled={fbs.length >= MAX_FALLBACKS}
        className="btn-outline btn-sm mt-2 w-full disabled:opacity-40">
        <Plus width={13} height={13} /> Add fallback {fbs.length ? `(${fbs.length}/${MAX_FALLBACKS})` : ''}
      </button>
    </div>
  );
}

function FallbackRow({ index, count, block, onType, onSet, onUp, onDown, onRemove }: {
  index: number; count: number; block: Block;
  onType: (t: BlockType) => void; onSet: (k: string, v: unknown) => void;
  onUp: () => void; onDown: () => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">{index + 2}</span>
        <select className="input !h-8 flex-1 !py-1 text-xs" value={block.type} onChange={(e) => onType(e.target.value as BlockType)}>
          {BLOCK_IDS.map((t) => <option key={t} value={t}>{BLOCKS[t].label}</option>)}
        </select>
        <button type="button" onClick={onUp} disabled={index === 0} className="grid h-7 w-6 place-items-center rounded border border-[var(--border)] text-xs text-[var(--muted)] disabled:opacity-30" title="Higher priority">↑</button>
        <button type="button" onClick={onDown} disabled={index === count - 1} className="grid h-7 w-6 place-items-center rounded border border-[var(--border)] text-xs text-[var(--muted)] disabled:opacity-30" title="Lower priority">↓</button>
        <button type="button" onClick={onRemove} className="grid h-7 w-6 place-items-center rounded border border-[var(--border)] text-red-600 hover:bg-red-50" title="Remove"><Trash width={12} height={12} /></button>
      </div>
      <FallbackControl block={block} onSet={onSet} />
    </div>
  );
}

/* ---- Schedule: an optional time window on the element ---- */

// datetime-local <input> speaks local wall-clock; we persist ISO (UTC). Convert
// both ways so the admin sees their own timezone and the renderer compares UTC.
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ScheduleEditor({ block, onPatch }: { block: Block; onPatch: (p: any) => void }) {
  const start = block.startAt ?? null;
  const end = block.endAt ?? null;
  const now = Date.now();
  const badStart = !!start && !!end && Date.parse(end) <= Date.parse(start);
  const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  // What the reader would see right now, given the window.
  let status: { tone: string; text: string };
  if (!start && !end) status = { tone: 'text-[var(--muted)]', text: 'Always on — no window set. Add one to make this element appear or retire on a schedule.' };
  else if (badStart) status = { tone: 'text-red-600', text: '“Until” is before “From” — this element would never show.' };
  else if (start && Date.parse(start) > now) status = { tone: 'text-amber-600', text: `Hidden until ${fmt(start)} — the slot shows your fallback until then.` };
  else if (end && Date.parse(end) < now) status = { tone: 'text-amber-600', text: `Expired ${fmt(end)} — the slot has fallen through to your fallback.` };
  else status = { tone: 'text-green-700 dark:text-green-400', text: `Live now${end ? ` until ${fmt(end)}` : ''}.` };

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
        Show <strong>{BLOCKS[block.type].label}</strong> only within a time window. Outside it, the slot falls through to your <strong>fallbacks</strong> — so a scheduled element takes over, then hands the slot back automatically when it ends.
      </p>
      <Field label="Show from">
        <div className="flex gap-1.5">
          <input type="datetime-local" className="input" value={isoToLocalInput(start)} onChange={(e) => onPatch({ startAt: localInputToIso(e.target.value) })} />
          {start && <button type="button" className="btn-outline btn-sm !px-2" title="Clear" onClick={() => onPatch({ startAt: null })}><X width={13} height={13} /></button>}
        </div>
      </Field>
      <Field label="Show until">
        <div className="flex gap-1.5">
          <input type="datetime-local" className="input" value={isoToLocalInput(end)} onChange={(e) => onPatch({ endAt: localInputToIso(e.target.value) })} />
          {end && <button type="button" className="btn-outline btn-sm !px-2" title="Clear" onClick={() => onPatch({ endAt: null })}><X width={13} height={13} /></button>}
        </div>
      </Field>
      <p className={`mt-1 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-2.5 py-2 text-xs font-medium ${status.tone}`}>{status.text}</p>
      <p className="mt-2 text-[11px] leading-tight text-[var(--muted)]">Times are in your local timezone. Leave a side blank for open-ended (e.g. “from” only = appears then and stays).</p>
    </div>
  );
}

/* ---- Access: who can see this element ---- */

// Requirement tokens the gate understands (mirrors lib/entitlements). Free-form
// affiliations also work, but these are the common ones surfaced in the UI.
const AUDIENCES: { value: string; label: string }[] = [
  { value: '', label: 'Everyone (public)' },
  { value: 'member', label: 'Signed-in members' },
  { value: 'premium', label: 'RS Premium' },
  { value: 'packagehub', label: 'Package Hub' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'staff', label: 'Staff' },
];

function AccessEditor({ block, onPatch }: { block: Block; onPatch: (p: any) => void }) {
  const req = block.requirement ?? '';
  const mode = block.gateMode ?? 'tease';
  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
        Restrict who sees <strong>{BLOCKS[block.type].label}</strong>. Everyone else either sees a locked teaser or nothing at all — your choice.
      </p>
      <Field label="Visible to">
        <select className="input" value={req} onChange={(e) => onPatch({ requirement: e.target.value })}>
          {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </Field>
      {req && (
        <Field label="Everyone else sees…">
          <div className="space-y-1.5">
            {([['tease', 'A locked teaser', 'They see it exists, with a prompt to sign in / upgrade. Best for conversion.'],
               ['swap', 'Nothing (fall through)', 'The slot quietly shows your fallback instead — no lock, no friction.']] as const).map(([v, title, desc]) => (
              <label key={v} className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 text-sm ${mode === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-[var(--border)]'}`}>
                <input type="radio" name={`gate-${block.id}`} checked={mode === v} onChange={() => onPatch({ gateMode: v })} className="mt-0.5" />
                <span><span className="font-semibold">{title}</span><span className="block text-[11px] text-[var(--muted)]">{desc}</span></span>
              </label>
            ))}
          </div>
        </Field>
      )}
      {!req && <p className="text-[11px] leading-tight text-[var(--muted)]">Public — no gate. Pick an audience above to restrict it.</p>}
    </div>
  );
}

// The one contextual field a fallback rung needs — kept minimal on purpose:
// fallbacks are generic "whatever's available of this type" safety nets.
function FallbackControl({ block, onSet }: { block: Block; onSet: (k: string, v: unknown) => void }) {
  const s = block.settings;
  switch (block.type) {
    case 'article': case 'article-image': case 'article-headline':
      return (
        <select className="input !h-8 !py-1 text-xs" value={String(s.source ?? 'latest')} onChange={(e) => onSet('source', e.target.value)}>
          <option value="featured">Featured</option><option value="latest">Latest</option><option value="trending">Trending</option>
        </select>
      );
    case 'ad':
      return (
        <select className="input !h-8 !py-1 text-xs" value={String(s.format ?? 'rectangle')} onChange={(e) => onSet('format', e.target.value)}>
          <option value="rectangle">Rectangle</option><option value="square">Square</option><option value="vertical">Vertical</option><option value="leaderboard">Leaderboard</option><option value="video">Video</option>
        </select>
      );
    case 'image':
      return <input className="input !h-8 !py-1 text-xs" value={String(s.url ?? '')} onChange={(e) => onSet('url', e.target.value)} placeholder="Image URL" />;
    case 'poll':
      return <EntityPicker value={String(s.pollId ?? '')} onChange={(id) => onSet('pollId', id)} endpoint="/api/admin/polls/search" placeholder="Poll (or leave for active)…" />;
    case 'quiz':
      return <EntityPicker value={String(s.quizId ?? '')} onChange={(id) => onSet('quizId', id)} endpoint="/api/admin/quizzes/search" placeholder="Quiz (or leave for active)…" />;
    case 'heading':
      return <input className="input !h-8 !py-1 text-xs" value={String(s.text ?? '')} onChange={(e) => onSet('text', e.target.value)} placeholder="Heading text" />;
    case 'text':
      return <input className="input !h-8 !py-1 text-xs" value={String(s.body ?? '')} onChange={(e) => onSet('body', e.target.value)} placeholder="Text" />;
    default:
      return null;
  }
}

