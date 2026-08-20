'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveHouseStyleRule, setHouseStyleRuleEnabled, deleteHouseStyleRule } from '@/lib/actions';
import { splitVariants } from '@/lib/houseStyle';
import { Plus, Check, X } from '@/components/icons';

type Rule = { id: string; canonical: string; variants: string; forceLowercase: boolean; message: string | null; builtin: boolean; enabled: boolean };
type Draft = { id?: string; canonical: string; variants: string; forceLowercase: boolean; message: string };

const BLANK: Draft = { canonical: '', variants: '', forceLowercase: false, message: '' };

export default function HouseStyleManager({ list }: { list: Rule[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, startSave] = useTransition();

  const openNew = () => setDraft({ ...BLANK });
  const openEdit = (r: Rule) => setDraft({ id: r.id, canonical: r.canonical, variants: r.variants, forceLowercase: r.forceLowercase, message: r.message ?? '' });

  const save = () => {
    if (!draft || !draft.canonical.trim()) return;
    startSave(async () => {
      await saveHouseStyleRule({ id: draft.id, canonical: draft.canonical, variants: draft.variants, forceLowercase: draft.forceLowercase, message: draft.message });
      setDraft(null);
      router.refresh();
    });
  };
  const toggle = (r: Rule, enabled: boolean) => startSave(async () => { await setHouseStyleRuleEnabled(r.id, enabled); router.refresh(); });
  const remove = (r: Rule) => {
    if (!confirm(`Delete the “${r.canonical}” rule?`)) return;
    startSave(async () => { await deleteHouseStyleRule(r.id); router.refresh(); });
  };

  const Row = ({ r }: { r: Rule }) => {
    const variants = splitVariants(r.variants);
    return (
      <div className={`flex items-start gap-3 rounded-xl border p-3 ${r.enabled ? 'border-[var(--border)] bg-[var(--card)]' : 'border-dashed border-[var(--border)] opacity-70'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold">{r.canonical}</span>
            {r.forceLowercase && <span className="badge bg-[var(--bg-soft)] text-[10px] uppercase tracking-wide text-[var(--muted)]">force lowercase</span>}
            {r.builtin && <span className="badge bg-[var(--bg-soft)] text-[10px] uppercase tracking-wide text-[var(--muted)]">built-in</span>}
            {!r.enabled && <span className="badge bg-amber-100 text-[10px] uppercase tracking-wide text-amber-800">off</span>}
          </div>
          {variants.length > 0 && (
            <div className="mt-1 text-xs text-[var(--muted)]">
              catches {variants.map((v, i) => (
                <span key={i}><span className="rounded bg-red-100 px-1 font-mono text-[11px] text-red-700 line-through dark:bg-red-950/40 dark:text-red-300">{v}</span>{i < variants.length - 1 ? ' ' : ''}</span>
              ))}
            </div>
          )}
          {r.message && <div className="mt-0.5 text-[11px] text-[var(--muted)]">{r.message}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(r)}>Edit</button>
          <button type="button" className="btn-outline btn-sm" disabled={saving} onClick={() => toggle(r, !r.enabled)}>{r.enabled ? 'Disable' : 'Enable'}</button>
          {!r.builtin && <button type="button" className="btn-outline btn-sm text-red-600" disabled={saving} onClick={() => remove(r)}>Delete</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {draft ? (
        <div className="card space-y-3 p-4">
          <div>
            <label className="label" htmlFor="hs-canon">Correct spelling (canonical)</label>
            <input id="hs-canon" className="input font-mono" value={draft.canonical} maxLength={120} autoFocus
              onChange={(e) => setDraft((d) => (d ? { ...d, canonical: e.target.value } : d))} placeholder="e.g. e-commerce" />
          </div>
          <div>
            <label className="label" htmlFor="hs-vars">Variants to catch <span className="font-normal text-[var(--muted)]">(comma or new line)</span></label>
            <textarea id="hs-vars" className="input min-h-[60px] font-mono" value={draft.variants}
              onChange={(e) => setDraft((d) => (d ? { ...d, variants: e.target.value } : d))} placeholder="ecommerce, e commerce" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">The off-house forms to flag. Case doesn&apos;t matter — a wrong-case version of the correct spelling is caught automatically.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" checked={draft.forceLowercase}
              onChange={(e) => setDraft((d) => (d ? { ...d, forceLowercase: e.target.checked } : d))} />
            <span>Always lowercase this term <span className="text-[var(--muted)]">(e.g. e-commerce, even at the start of a sentence)</span></span>
          </label>
          <div>
            <label className="label" htmlFor="hs-msg">Note <span className="font-normal text-[var(--muted)]">(optional)</span></label>
            <input id="hs-msg" className="input" value={draft.message} maxLength={300}
              onChange={(e) => setDraft((d) => (d ? { ...d, message: e.target.value } : d))} placeholder="Shown with the suggestion — why it's house style" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn-primary btn-sm" disabled={saving || !draft.canonical.trim()} onClick={save}>
              <Check width={14} height={14} /> {draft.id ? 'Save changes' : 'Add rule'}
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setDraft(null)}><X width={14} height={14} /> Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary btn-sm" onClick={openNew}><Plus width={14} height={14} /> New rule</button>
      )}

      <div className="space-y-2">
        {list.length === 0 && !draft && <p className="text-sm text-[var(--muted)]">No rules yet. Add one to enforce a house spelling.</p>}
        {list.map((r) => <Row key={r.id} r={r} />)}
      </div>
    </div>
  );
}
