'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveHomeModule, toggleHomeModule, resetHomeLayout } from '@/lib/actions';
import { ChevronUp, ChevronDown, Check, Eye } from '@/components/icons';

type Row = { id: string; label: string; description: string; enabled: boolean };

export default function HomeLayoutEditor({ modules }: { modules: Row[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div>
      {/* The pinned headline block, shown as fixed and non-movable. */}
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4 dark:bg-brand-950/40">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">★</span>
        <div className="flex-1">
          <div className="font-semibold">Headline block <span className="ml-1 text-xs font-normal text-[var(--muted)]">(pinned — always first)</span></div>
          <div className="text-sm text-[var(--muted)]">Lead story + supporting headlines. This never moves.</div>
        </div>
      </div>

      <ol className="space-y-2">
        {modules.map((m, i) => (
          <li key={m.id} className={`flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-card ${m.enabled ? '' : 'opacity-60'}`}>
            <div className="flex flex-col">
              <button disabled={pending || i === 0} onClick={() => run(() => moveHomeModule(m.id, 'up'))}
                className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] disabled:opacity-30" aria-label="Move up">
                <ChevronUp width={18} height={18} />
              </button>
              <button disabled={pending || i === modules.length - 1} onClick={() => run(() => moveHomeModule(m.id, 'down'))}
                className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] disabled:opacity-30" aria-label="Move down">
                <ChevronDown width={18} height={18} />
              </button>
            </div>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--bg-soft)] text-xs font-bold text-[var(--muted)]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.label}</div>
              <div className="truncate text-sm text-[var(--muted)]">{m.description}</div>
            </div>
            <button disabled={pending} onClick={() => run(() => toggleHomeModule(m.id))}
              className={`btn-sm ${m.enabled ? 'btn-primary' : 'btn-outline'}`}>
              {m.enabled ? <><Check width={14} height={14} /> Visible</> : <><Eye width={14} height={14} /> Hidden</>}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Changes apply to the public homepage instantly.</p>
        <button disabled={pending} onClick={() => run(() => resetHomeLayout())} className="btn-outline btn-sm">Reset to default</button>
      </div>
    </div>
  );
}
