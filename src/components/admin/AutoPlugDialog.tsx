'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { findPollQuizSlots, pinToSlot, addElementToHomepage, type PlugSlot } from '@/lib/actions';
import { Home, Check, Grid, X, Pin } from '@/components/icons';

// Shown right after a poll/quiz is created: offer to place it on the homepage
// without the admin having to remember whether a spot exists or go build one.
//   • Pin to an existing slot (a module that already has a poll/quiz element)
//   • Publish it as its own single-element module (always available)
//   • Open the relevant module in Studio to arrange it by hand
//   • Dismiss
export default function AutoPlugDialog({ kind, id, name, onClose }: {
  kind: 'poll' | 'quiz'; id: string; name: string; onClose: () => void;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<PlugSlot[] | null>(null); // null = still loading
  const [slotIdx, setSlotIdx] = useState(0);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ text: string; moduleId?: string } | null>(null);

  useEffect(() => {
    let live = true;
    findPollQuizSlots(kind).then((s) => { if (live) setSlots(s); }).catch(() => { if (live) setSlots([]); });
    return () => { live = false; };
  }, [kind]);

  const label = kind === 'poll' ? 'poll' : 'quiz';
  const slot = slots && slots.length ? slots[Math.min(slotIdx, slots.length - 1)] : null;

  const pin = () => {
    if (!slot) return;
    start(async () => {
      await pinToSlot(kind, id, slot.moduleId, slot.blockId);
      setResult({ text: `Pinned into “${slot.moduleName}”.`, moduleId: slot.moduleId });
      router.refresh();
    });
  };
  const publishOwn = () => {
    start(async () => {
      await addElementToHomepage(kind, id, name, 'card', null);
      setResult({ text: 'Published as its own module — staged on the homepage.' });
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-lg font-black tracking-tight">Put this {label} on the homepage?</h2>
          <button onClick={onClose} className="btn-ghost btn-sm !px-2" aria-label="Close"><X width={16} height={16} /></button>
        </div>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Saved <strong className="text-[var(--fg)]">“{name}”</strong>. Drop it into a spot now, or skip and place it later in the Module Studio.
        </p>

        {result ? (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm dark:border-green-900/60 dark:bg-green-950/30">
            <p className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300"><Check width={15} height={15} /> {result.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/admin/homepage" className="btn-outline btn-sm"><Home width={13} height={13} /> Arrange &amp; Go Live</Link>
              {result.moduleId && <Link href={`/admin/studio/${result.moduleId}`} className="btn-outline btn-sm"><Grid width={13} height={13} /> Open in Studio</Link>}
              <button onClick={onClose} className="btn-ghost btn-sm">Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 1 — pin to an existing spot (only when one exists) */}
            {slot && (
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Pin width={14} height={14} className="text-brand-600" /> Pin to an existing spot</div>
                {slots && slots.length > 1 ? (
                  <select className="input mt-2 !h-9 !py-1 text-sm" value={slotIdx} onChange={(e) => setSlotIdx(Number(e.target.value))}>
                    {slots.map((s, i) => <option key={s.moduleId} value={i}>{s.moduleName}{s.filled ? ' (replaces current)' : ''}</option>)}
                  </select>
                ) : (
                  <p className="mt-1 text-xs text-[var(--muted)]">In <strong>{slot.moduleName}</strong>{slot.filled ? ' — replaces what it shows now' : ''}.</p>
                )}
                <button onClick={pin} disabled={pending} className="btn-primary btn-sm mt-2 w-full">Pin here</button>
              </div>
            )}

            {/* 2 — publish as its own module (always available) */}
            <div className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Home width={14} height={14} className="text-brand-600" /> Publish as its own module</div>
              <p className="mt-1 text-xs text-[var(--muted)]">Wraps it in a new single-element module and stages it on the homepage. {slots && slots.length === 0 && <em>No poll/quiz spot exists yet — this is the quickest route.</em>}</p>
              <button onClick={publishOwn} disabled={pending} className={`btn-sm mt-2 w-full ${slot ? 'btn-outline' : 'btn-primary'}`}>Publish as module</button>
            </div>

            {/* 3 / 4 — go arrange by hand, or dismiss */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Link href={slot ? `/admin/studio/${slot.moduleId}` : '/admin/studio'} className="btn-ghost btn-sm"><Grid width={13} height={13} /> {slot ? 'View spot in Studio' : 'Open Studio'}</Link>
              <button onClick={onClose} className="btn-ghost btn-sm">Not now</button>
            </div>
            {slots === null && <p className="pt-1 text-center text-xs text-[var(--muted)]">Checking for existing spots…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
