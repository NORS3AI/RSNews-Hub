'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import ModuleAdminToolbar from './ModuleAdminToolbar';
import { reorderHomeLive, setHomeVisibilityLive } from '@/lib/actions';
import type { ModuleTree } from '@/lib/studio';
import { Grip, Eye, Check, Plus, Lock, ChevronUp, ChevronDown } from '@/components/icons';

// One arrangeable module. `node` is the server-rendered module content; the rest
// is metadata the on-page controls need (labels, locks, custom-module colors).
export type ArrangeItem = {
  id: string; span: number; locked: boolean; sizeLocked: boolean;
  isCustom: boolean; href: string; editLabel: string; label: string;
  colorTree?: ModuleTree; name?: string;
  node: ReactNode;
};

const spanClass = (span: number) => (span === 1 ? 'lg:col-span-1' : span === 2 ? 'lg:col-span-2' : 'lg:col-span-3');

// The live homepage module grid for admins. Normally it renders exactly like the
// public grid (each module + its hover toolbar). Hit "Arrange" and it flips into
// a single-column drag surface: drag the handle to reorder, click the eye to
// hide, and re-show hidden modules from the tray. Order + visibility save live.
export default function HomeArrangeGrid({ items, hidden }: { items: ArrangeItem[]; hidden: { id: string; label: string }[] }) {
  const router = useRouter();
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState<string[]>(items.map((i) => i.id));
  const [hiddenNow, setHiddenNow] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = new Map(items.map((i) => [i.id, i]));
  // `order` holds the visible modules only, in display order.
  const visible = order.map((id) => byId.get(id)).filter((it): it is ArrangeItem => !!it);

  // Drop `from` immediately before `to` (drag reorder).
  function move(from: string, to: string) {
    if (from === to) return;
    setOrder((cur) => {
      const next = [...cur];
      const fi = next.indexOf(from);
      const ti = next.indexOf(to);
      if (fi < 0 || ti < 0) return cur;
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
  }

  // Nudge one slot up/down (arrow buttons — reliable on touch + keyboard).
  function bump(id: string, dir: -1 | 1) {
    setOrder((cur) => {
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function hide(id: string) {
    setHiddenNow((s) => new Set(s).add(id));
    setOrder((cur) => cur.filter((x) => x !== id));
    start(async () => { await setHomeVisibilityLive(id, false); });
  }
  function show(id: string) {
    // The module wasn't rendered while hidden, so bring it back with a refresh.
    start(async () => { await setHomeVisibilityLive(id, true); router.refresh(); });
  }

  function done() {
    const finalOrder = visible.map((it) => it.id);
    start(async () => { await reorderHomeLive(finalOrder); router.refresh(); setArranging(false); });
  }

  // ---- Normal (published) view: identical to the public grid + hover toolbars ----
  if (!arranging) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => { setOrder(items.map((i) => i.id)); setHiddenNow(new Set()); setArranging(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-bold text-[var(--fg)] shadow-card transition hover:border-brand-400 hover:text-brand-600">
            <Grip width={15} height={15} /> Arrange modules
          </button>
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:items-start lg:gap-x-6 lg:gap-y-[52px]">
          {items.map((it) => (
            <div key={`m-${it.id}`} className={`group relative ${spanClass(it.span)}`}>
              {it.node}
              <ModuleAdminToolbar id={it.id} href={it.href} editLabel={it.editLabel}
                locked={it.locked} sizeLocked={it.sizeLocked}
                {...(it.colorTree ? { colorTree: it.colorTree, name: it.name } : {})} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Arrange mode: single-column drag surface ----
  return (
    <div>
      <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-300 bg-brand-50 px-4 py-2.5 shadow-card dark:border-brand-800 dark:bg-brand-950/40">
        <Grip width={16} height={16} className="text-brand-600" />
        <span className="text-sm font-bold text-brand-800 dark:text-brand-200">Arranging modules</span>
        <span className="hidden text-sm text-[var(--muted)] sm:inline">Drag by the handle or use the ▲▼ arrows to reorder · Hide to remove · widths return when you finish.</span>
        <button type="button" onClick={done} disabled={pending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
          <Check width={15} height={15} /> {pending ? 'Saving…' : 'Done'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((it, idx) => (
          <div key={`arr-${it.id}`} data-arrange-row={it.id}
            draggable={!it.locked}
            onDragStart={() => setDragId(it.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== it.id) move(dragId, it.id); }}
            className={`relative rounded-2xl border-2 border-dashed p-2 transition ${dragId === it.id ? 'border-brand-500 opacity-60' : 'border-[var(--border)]'} ${it.locked ? 'bg-[var(--bg-soft)]' : 'bg-[var(--card)]'}`}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`grid h-7 w-7 place-items-center rounded-md ${it.locked ? 'cursor-not-allowed text-[var(--muted)]' : 'cursor-grab text-brand-600 active:cursor-grabbing'}`} title={it.locked ? 'Locked in place' : 'Drag to reorder'}>
                {it.locked ? <Lock width={15} height={15} /> : <Grip width={16} height={16} />}
              </span>
              {/* Arrow nudge — works on touch/keyboard where native drag can't. */}
              <span className="flex flex-col">
                <button type="button" onClick={() => bump(it.id, -1)} disabled={it.locked || idx === 0} title="Move up"
                  className="grid h-3.5 w-6 place-items-center rounded text-[var(--muted)] transition hover:text-brand-600 disabled:opacity-30"><ChevronUp width={13} height={13} /></button>
                <button type="button" onClick={() => bump(it.id, 1)} disabled={it.locked || idx === visible.length - 1} title="Move down"
                  className="grid h-3.5 w-6 place-items-center rounded text-[var(--muted)] transition hover:text-brand-600 disabled:opacity-30"><ChevronDown width={13} height={13} /></button>
              </span>
              <span className="text-sm font-bold">{it.label}</span>
              {it.locked && <span className="rounded bg-[var(--border)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Locked</span>}
              <button type="button" onClick={() => hide(it.id)} disabled={pending}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-bold text-[var(--muted)] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50">
                <Eye width={13} height={13} /> Hide
              </button>
            </div>
            {/* The real module, non-interactive while arranging. */}
            <div className="pointer-events-none overflow-hidden rounded-xl opacity-95">{it.node}</div>
          </div>
        ))}
      </div>

      {/* Hidden-modules tray */}
      {(hidden.length > 0 || hiddenNow.size > 0) && (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Hidden modules — click to show</div>
          <div className="flex flex-wrap gap-2">
            {[...hidden, ...items.filter((i) => hiddenNow.has(i.id)).map((i) => ({ id: i.id, label: i.label }))].map((h) => (
              <button key={`hid-${h.id}`} type="button" onClick={() => show(h.id)} disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-semibold transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50">
                <Plus width={13} height={13} /> {h.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
