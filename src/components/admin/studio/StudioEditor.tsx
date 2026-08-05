'use client';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BLOCKS, BLOCK_GROUPS, blocksInGroup, SHAPES, SHAPE_IDS, makeBlock, MAX_BLOCKS,
  type ModuleTree, type Block, type BlockType, type Shape,
} from '@/lib/studio';
import { BlockView, shapeInnerClass, childWidthClass, shapeContainerClass, rsStyle } from '@/components/site/CustomModule';
import { saveCustomModuleTree, renameCustomModule, setCustomModulePublished } from '@/lib/actions';
import EntityPicker from '@/components/admin/studio/EntityPicker';
import RsColorPicker from '@/components/admin/studio/RsColorPicker';
import { ArrowLeft, Plus, Grip, Trash, Copy, Check, ChevronDown, ChevronRight } from '@/components/icons';

function newId(): string {
  try { return 'b' + crypto.randomUUID().slice(0, 8); } catch { return 'b' + Date.now().toString(36); }
}

type DragState = { kind: 'palette'; type: BlockType; preset?: Record<string, unknown> } | { kind: 'move'; index: number } | null;

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
  id, name: initialName, published, initialTree,
}: { id: string; name: string; published: boolean; initialTree: ModuleTree }) {
  const router = useRouter();
  const [tree, setTree] = useState<ModuleTree>(initialTree);
  const [name, setName] = useState(initialName);
  const [pub, setPub] = useState(published);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [rsPreview, setRsPreview] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [saving, startSave] = useTransition();
  const drag = useRef<DragState>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [past, setPast] = useState<ModuleTree[]>([]);
  const [future, setFuture] = useState<ModuleTree[]>([]);

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
  function patchSelected(patch: Partial<Block> | { settings: Record<string, unknown> }) {
    if (!selectedBlock) return;
    mutate((t) => {
      const b = t.children.find((x) => x.id === selectedBlock.id);
      if (!b) return t;
      if ('settings' in patch && patch.settings) b.settings = { ...b.settings, ...patch.settings };
      if ('rsColor' in patch) b.rsColor = (patch as any).rsColor;
      if ('label' in patch) b.label = ((patch as any).label as string) || undefined;
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
          : <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">Draft</span>}
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
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">Canvas</span>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={rsPreview} onChange={(e) => setRsPreview(e.target.checked)} /> RS-Mode preview
            </label>
          </div>
          <div className={`mx-auto w-full max-w-2xl ${rsPreview ? 'rs rounded-2xl' : ''}`}>
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
                  {tree.children.map((b, i) => (
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
                      >
                        <BlockView block={b} />
                      </BlockFrame>
                    </div>
                  ))}
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
            : <ModuleInspector tree={tree} onShape={setShape} onColor={setContainerColor} />}
        </aside>
      </div>
    </div>
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

function BlockFrame({ selected, over, label, children, onSelect, onDragStart, onDragEnd, onRemove, onDuplicate }: {
  selected: boolean; over: boolean; label: string; children: React.ReactNode;
  onSelect: (e: React.MouseEvent) => void; onDragStart: () => void; onDragEnd: () => void;
  onRemove: (e: React.MouseEvent) => void; onDuplicate: (e: React.MouseEvent) => void;
}) {
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

function ModuleInspector({ tree, onShape, onColor }: { tree: ModuleTree; onShape: (s: Shape) => void; onColor: (c: string | null) => void }) {
  return (
    <InspectorShell title="Module">
      <Field label="Shape">
        <select className="input" value={tree.shape} onChange={(e) => onShape(e.target.value as Shape)}>
          {SHAPE_IDS.map((s) => <option key={s} value={s}>{SHAPES[s].label}</option>)}
        </select>
      </Field>
      <Field label="Background"><RsColorPicker value={tree.rsColor} onChange={onColor} /></Field>
      <p className="text-xs text-[var(--muted)]">Select an element on the canvas to edit its settings. {tree.children.length} element{tree.children.length === 1 ? '' : 's'} in this module.</p>
    </InspectorShell>
  );
}

function BlockInspector({ block, onPatch, onRemove, onDuplicate }: {
  block: Block; onPatch: (p: any) => void; onRemove: () => void; onDuplicate: () => void;
}) {
  const s = block.settings;
  const set = (k: string, v: unknown) => onPatch({ settings: { [k]: v } });
  const [tab, setTab] = useState<'content' | 'style'>('content');
  return (
    <InspectorShell title={BLOCKS[block.type].label}>
      <div className="mb-3 inline-flex gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-0.5 text-xs font-bold">
        {(['content', 'style'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1 capitalize ${tab === t ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>{t}</button>
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
        <Field label="Ad format">
          <select className="input" value={String(s.format ?? 'rectangle')} onChange={(e) => set('format', e.target.value)}>
            <option value="rectangle">Rectangle (medium)</option>
            <option value="square">Square (fits a sidebar)</option>
            <option value="vertical">Vertical (skyscraper)</option>
            <option value="leaderboard">Leaderboard (wide banner)</option>
            <option value="video">Video</option>
          </select>
        </Field>
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
          <Field label="Question"><input className="input" value={String(s.question ?? '')} onChange={(e) => set('question', e.target.value)} placeholder="What's your question?" /></Field>
          <PollOptions options={Array.isArray(s.options) ? (s.options as string[]) : []} onChange={(opts) => set('options', opts)} />
          <Field label="Timer"><TimerField hours={Number(s.timerHours ?? 72)} unit={String(s.timerUnit ?? 'hours')} onChange={(h, u) => onPatch({ settings: { timerHours: h, timerUnit: u } })} /></Field>
          <Field label="Results chart">
            <select className="input" value={String(s.chart ?? 'bar')} onChange={(e) => set('chart', e.target.value)}>
              <option value="bar">Bars</option>
              <option value="pie">Pie</option>
            </select>
          </Field>
          <p className="-mt-1 mb-3 text-[11px] text-[var(--muted)]">When the timer ends the poll closes, is logged, and moves to the archive.</p>
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

      <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-3">
        <button onClick={onDuplicate} className="btn-outline btn-sm flex-1"><Copy width={13} height={13} /> Duplicate</button>
        <button onClick={onRemove} className="btn-danger btn-sm flex-1"><Trash width={13} height={13} /> Remove</button>
      </div>
    </InspectorShell>
  );
}

function TimerField({ hours, unit, onChange }: { hours: number; unit: string; onChange: (hours: number, unit: string) => void }) {
  const n = unit === 'days' ? Math.max(1, Math.round(hours / 24)) : hours;
  return (
    <div className="flex gap-2">
      <input type="number" min={1} className="input" value={n || ''} onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); onChange(unit === 'days' ? v * 24 : v, unit); }} />
      <select className="input !w-28" value={unit} onChange={(e) => onChange(hours, e.target.value)}>
        <option value="hours">hours</option>
        <option value="days">days</option>
      </select>
    </div>
  );
}

function ArticleFillFields({ s, set }: { s: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const mode = String(s.mode ?? 'auto');
  return (
    <>
      <Field label="Fill with">
        <select className="input" value={mode} onChange={(e) => set('mode', e.target.value)}>
          <option value="auto">Auto — from a pool</option>
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

function PollOptions({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const list = options.length ? options : ['', ''];
  return (
    <Field label="Options">
      <div className="space-y-1.5">
        {list.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input className="input" value={o} onChange={(e) => { const next = list.slice(); next[i] = e.target.value; onChange(next); }} placeholder={`Option ${i + 1}`} />
            {list.length > 2 && <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="btn-outline btn-sm" aria-label="Remove option"><Trash width={12} height={12} /></button>}
          </div>
        ))}
      </div>
      {list.length < 12 && <button onClick={() => onChange([...list, ''])} className="btn-outline btn-sm mt-1.5"><Plus width={12} height={12} /> Add option</button>}
    </Field>
  );
}
