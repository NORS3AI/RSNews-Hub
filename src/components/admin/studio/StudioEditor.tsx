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
import { ArrowLeft, Plus, Grip, Trash, Copy, Check, ChevronDown, ChevronRight } from '@/components/icons';

function newId(): string {
  try { return 'b' + crypto.randomUUID().slice(0, 8); } catch { return 'b' + Date.now().toString(36); }
}

type DragState = { kind: 'palette'; type: BlockType } | { kind: 'move'; index: number } | null;

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

  const selectedBlock = useMemo(() => tree.children.find((b) => b.id === selected) ?? null, [tree, selected]);

  // Warn before leaving with unsaved changes (browser nav / refresh / close).
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  /* ---- tree mutations ---- */
  const mutate = (fn: (t: ModuleTree) => ModuleTree) => { setTree((t) => fn(structuredClone(t))); setDirty(true); };

  function addBlock(type: BlockType, at?: number) {
    if (tree.children.length >= MAX_BLOCKS) return;
    const block = makeBlock(type, newId());
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
      return t;
    });
  }

  /* ---- drag & drop ---- */
  function onDropAt(index: number) {
    const d = drag.current;
    setOverIndex(null);
    drag.current = null;
    if (!d) return;
    if (d.kind === 'palette') addBlock(d.type, index);
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
          ? <span className="badge bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Published</span>
          : <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">Draft</span>}
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="flex items-center gap-1.5 text-sm text-amber-600"><span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved</span>}
          <button onClick={save} disabled={saving || !dirty} className="btn-outline btn-sm">
            {saving ? 'Saving…' : <><Check width={14} height={14} /> Save</>}
          </button>
          <button onClick={togglePublish} disabled={saving} className={pub ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}>
            {pub ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Follow-through nudge: a saved-but-unpublished module isn't live yet. */}
      {!pub && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          This module is <strong>saved for later</strong> — it isn&apos;t staged on the homepage yet. Click <strong>Publish</strong> to stage it (then Go Live from Homepage layout).
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
          <Panel title="Add block">
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
                        {blocksInGroup(g).map((t) => (
                          <button key={t}
                            draggable
                            onDragStart={() => { drag.current = { kind: 'palette', type: t }; }}
                            onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                            onClick={() => addBlock(t)}
                            disabled={tree.children.length >= MAX_BLOCKS}
                            className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-2 text-left text-xs font-semibold hover:border-brand-400 disabled:opacity-40"
                            title={BLOCKS[t].description}>
                            <Plus width={13} height={13} className="shrink-0 text-brand-600" /> {BLOCKS[t].label}
                          </button>
                        ))}
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
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Canvas</span>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
              <input type="checkbox" checked={rsPreview} onChange={(e) => setRsPreview(e.target.checked)} /> RS-Mode preview
            </label>
          </div>
          <div className={rsPreview ? 'rs rounded-2xl' : ''}>
            <section className={`module studio-fill min-h-[200px] ${shapeContainerClass(tree.shape)}`} style={rsStyle(tree.rsColor)}
              onClick={() => setSelected(null)}>
              {tree.children.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setOverIndex(0); }}
                  onDrop={() => onDropAt(0)}
                  className={`grid min-h-[160px] place-items-center rounded-xl border-2 border-dashed p-6 text-center text-sm text-[var(--muted)] ${overIndex === 0 ? 'border-brand-500 bg-brand-50/50' : 'border-[var(--border)]'}`}>
                  Drag a block here, or click one in the palette.
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

function ColorControl({ value, onChange }: { value: string | null | undefined; onChange: (c: string | null) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#e97d34'} onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" />
        <input className="input flex-1 font-mono text-xs" value={value || ''} placeholder="theme default"
          onChange={(e) => { const v = e.target.value.trim(); onChange(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : v === '' ? null : value ?? null); }} />
        {value && <button onClick={() => onChange(null)} className="btn-outline btn-sm">Clear</button>}
      </div>
      <p className="mt-1 text-[11px] text-[var(--muted)]">Applies in <strong>RS Mode</strong> only. Toggle “RS-Mode preview” to see it.</p>
    </div>
  );
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
      <Field label="Background color"><ColorControl value={tree.rsColor} onChange={onColor} /></Field>
      <p className="text-xs text-[var(--muted)]">Select a block on the canvas to edit its settings. {tree.children.length} block{tree.children.length === 1 ? '' : 's'} in this module.</p>
    </InspectorShell>
  );
}

function BlockInspector({ block, onPatch, onRemove, onDuplicate }: {
  block: Block; onPatch: (p: any) => void; onRemove: () => void; onDuplicate: () => void;
}) {
  const s = block.settings;
  const set = (k: string, v: unknown) => onPatch({ settings: { [k]: v } });
  return (
    <InspectorShell title={BLOCKS[block.type].label}>
      {(block.type === 'article' || block.type === 'article-image') && (
        <>
          <Field label="Source">
            <select className="input" value={String(s.source ?? 'latest')} onChange={(e) => set('source', e.target.value)}>
              <option value="featured">Featured</option>
              <option value="latest">Latest</option>
              <option value="trending">Trending</option>
            </select>
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.showDek !== false} onChange={(e) => set('showDek', e.target.checked)} /> Show standfirst (dek)</label>
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
      {block.type === 'article-headline' && (
        <Field label="Source">
          <select className="input" value={String(s.source ?? 'latest')} onChange={(e) => set('source', e.target.value)}>
            <option value="featured">Featured</option>
            <option value="latest">Latest</option>
            <option value="trending">Trending</option>
          </select>
        </Field>
      )}
      {block.type === 'ad' && (
        <Field label="Ad format">
          <select className="input" value={String(s.format ?? 'rectangle')} onChange={(e) => set('format', e.target.value)}>
            <option value="rectangle">Rectangle (medium)</option>
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
        <p className="mb-3 text-sm text-[var(--muted)]">Shows the current Pop Quiz on the homepage. Manage quizzes under <strong>Pop Quiz</strong>.</p>
      )}
      {block.type === 'poll' && (
        <>
          <Field label="Question"><input className="input" value={String(s.question ?? '')} onChange={(e) => set('question', e.target.value)} placeholder="What's your question?" /></Field>
          <PollOptions options={Array.isArray(s.options) ? (s.options as string[]) : []} onChange={(opts) => set('options', opts)} />
          <Field label="Timer (hours)"><input type="number" min={1} className="input" value={Number(s.timerHours ?? 72)} onChange={(e) => set('timerHours', Number(e.target.value))} /></Field>
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

      <Field label="Color"><ColorControl value={block.rsColor} onChange={(c) => onPatch({ rsColor: c })} /></Field>

      <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-3">
        <button onClick={onDuplicate} className="btn-outline btn-sm flex-1"><Copy width={13} height={13} /> Duplicate</button>
        <button onClick={onRemove} className="btn-danger btn-sm flex-1"><Trash width={13} height={13} /> Remove</button>
      </div>
    </InspectorShell>
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
