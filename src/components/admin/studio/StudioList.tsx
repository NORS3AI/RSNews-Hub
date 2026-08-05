'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SHAPES, SHAPE_IDS, type Shape } from '@/lib/studio';
import { createCustomModule, setCustomModulePublished, deleteCustomModule } from '@/lib/actions';
import { Plus, Edit, Trash, Check, Eye, Grid } from '@/components/icons';

type Mod = { id: string; name: string; shape: string; published: boolean; blocks: number; updatedAt: string };

export default function StudioList({ modules }: { modules: Mod[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [shape, setShape] = useState<Shape>('column');
  const run = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  function create() {
    const n = name.trim();
    start(async () => {
      const id = await createCustomModule(n || 'Untitled module', shape);
      router.push(`/admin/studio/${id}`);
    });
  }

  return (
    <div>
      {/* New module */}
      <div className="mb-6 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4 dark:bg-brand-950/40">
        <div className="mb-3 flex items-center gap-2 font-semibold"><Plus width={16} height={16} /> New module</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="label">Name</span>
            <input className="input" placeholder="e.g. Editor's picks column" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          </label>
          <label>
            <span className="label">Shape</span>
            <select className="input !w-44" value={shape} onChange={(e) => setShape(e.target.value as Shape)}>
              {SHAPE_IDS.map((s) => <option key={s} value={s}>{SHAPES[s].label}</option>)}
            </select>
          </label>
          <button disabled={pending} className="btn-primary" onClick={create}>Create &amp; edit</button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{SHAPES[shape].description}</p>
      </div>

      {/* Existing modules */}
      {modules.length === 0 ? (
        <div className="card grid place-items-center gap-2 p-10 text-center">
          <Grid width={28} height={28} className="text-[var(--muted)]" />
          <p className="font-semibold">No custom modules yet.</p>
          <p className="max-w-sm text-sm text-[var(--muted)]">Create your first module above. Once you publish it, add it to the homepage from <Link href="/admin/homepage" className="text-brand-600 hover:underline">Homepage layout</Link>.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {modules.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-soft)] text-[var(--muted)]"><Grid width={16} height={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {m.name}
                  {m.published
                    ? <span className="badge bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Published</span>
                    : <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">Draft</span>}
                </div>
                <div className="text-sm text-[var(--muted)]">{SHAPES[m.shape as Shape]?.label ?? m.shape} · {m.blocks} block{m.blocks === 1 ? '' : 's'}</div>
              </div>
              <Link href={`/admin/studio/${m.id}`} className="btn-outline btn-sm"><Edit width={14} height={14} /> Edit</Link>
              <button disabled={pending} onClick={() => run(() => setCustomModulePublished(m.id, !m.published))}
                className={`btn-sm ${m.published ? 'btn-outline' : 'btn-primary'}`}>
                {m.published ? <><Eye width={14} height={14} /> Unpublish</> : <><Check width={14} height={14} /> Publish</>}
              </button>
              <button disabled={pending} onClick={() => { if (confirm(`Delete “${m.name}”? This also removes it from the homepage.`)) run(() => deleteCustomModule(m.id)); }}
                className="btn-sm btn-danger" aria-label="Delete module"><Trash width={14} height={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
