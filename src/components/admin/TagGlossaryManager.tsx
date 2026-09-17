'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveTagGlossaryTerm, setTagGlossaryTermEnabled, deleteTagGlossaryTerm } from '@/lib/actions';
import { splitVariants } from '@/lib/houseStyle';
import { Plus, Check, X } from '@/components/icons';

type Term = { id: string; canonical: string; variants: string; builtin: boolean; enabled: boolean };
type Draft = { id?: string; canonical: string; variants: string };

const BLANK: Draft = { canonical: '', variants: '' };

// RS Dictionary → Tag glossary tab. The industry vocabulary the tag suggester
// draws on: each term is a canonical tag plus the spellings/plurals/phrases that
// should map to it. Built-ins can be edited or turned off, not deleted.
export default function TagGlossaryManager({ list }: { list: Term[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, startSave] = useTransition();

  const openNew = () => setDraft({ ...BLANK });
  const openEdit = (t: Term) => setDraft({ id: t.id, canonical: t.canonical, variants: t.variants });

  const save = () => {
    if (!draft || !draft.canonical.trim()) return;
    startSave(async () => {
      await saveTagGlossaryTerm({ id: draft.id, canonical: draft.canonical, variants: draft.variants });
      setDraft(null);
      router.refresh();
    });
  };
  const toggle = (t: Term, enabled: boolean) => startSave(async () => { await setTagGlossaryTermEnabled(t.id, enabled); router.refresh(); });
  const remove = (t: Term) => {
    if (!confirm(`Delete the “${t.canonical}” glossary term?`)) return;
    startSave(async () => { await deleteTagGlossaryTerm(t.id); router.refresh(); });
  };

  const Row = ({ t }: { t: Term }) => {
    const variants = splitVariants(t.variants);
    return (
      <div className={`flex items-start gap-3 rounded-xl border p-3 ${t.enabled ? 'border-[var(--border)] bg-[var(--card)]' : 'border-dashed border-[var(--border)] opacity-70'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-brand-500/15 text-sm font-bold text-brand-700 dark:text-brand-300">{t.canonical}</span>
            {t.builtin && <span className="badge bg-[var(--bg-soft)] text-[10px] uppercase tracking-wide text-[var(--muted)]">built-in</span>}
            {!t.enabled && <span className="badge bg-amber-100 text-[10px] uppercase tracking-wide text-amber-800">off</span>}
          </div>
          {variants.length > 0 && (
            <div className="mt-1 text-xs text-[var(--muted)]">
              also matches {variants.map((v, i) => (
                <span key={i}><span className="rounded bg-emerald-100 px-1 font-mono text-[11px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{v}</span>{i < variants.length - 1 ? ' ' : ''}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(t)}>Edit</button>
          <button type="button" className="btn-outline btn-sm" disabled={saving} onClick={() => toggle(t, !t.enabled)}>{t.enabled ? 'Disable' : 'Enable'}</button>
          {!t.builtin && <button type="button" className="btn-outline btn-sm text-red-600" disabled={saving} onClick={() => remove(t)}>Delete</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {draft ? (
        <div className="card space-y-3 p-4">
          <div>
            <label className="label" htmlFor="tg-canon">Tag <span className="font-normal text-[var(--muted)]">(what gets suggested)</span></label>
            <input id="tg-canon" className="input" value={draft.canonical} maxLength={120} autoFocus
              onChange={(e) => setDraft((d) => (d ? { ...d, canonical: e.target.value } : d))} placeholder="e.g. e-commerce" />
          </div>
          <div>
            <label className="label" htmlFor="tg-vars">Also matches <span className="font-normal text-[var(--muted)]">(comma or new line)</span></label>
            <textarea id="tg-vars" className="input min-h-[60px] font-mono" value={draft.variants}
              onChange={(e) => setDraft((d) => (d ? { ...d, variants: e.target.value } : d))} placeholder="ecommerce, e commerce, online store" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Spellings, plurals, or phrasings that should all suggest this one tag. Case and hyphen-vs-space don&apos;t matter. Leave blank if the tag is only ever written one way.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn-primary btn-sm" disabled={saving || !draft.canonical.trim()} onClick={save}>
              <Check width={14} height={14} /> {draft.id ? 'Save changes' : 'Add term'}
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setDraft(null)}><X width={14} height={14} /> Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary btn-sm" onClick={openNew}><Plus width={14} height={14} /> New term</button>
      )}

      <div className="space-y-2">
        {list.length === 0 && !draft && <p className="text-sm text-[var(--muted)]">No glossary terms yet. Add one so the suggester knows your industry&apos;s vocabulary.</p>}
        {list.map((t) => <Row key={t.id} t={t} />)}
      </div>
    </div>
  );
}
