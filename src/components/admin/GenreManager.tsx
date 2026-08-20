'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveGenre, setGenreArchived, deleteGenre } from '@/lib/actions';
import { SPONSORED_GENRE } from '@/lib/genre';
import { Plus, Check, X } from '@/components/icons';

type G = { id: string; slug: string; label: string; color: string; builtin: boolean; archived: boolean };
type Draft = { id?: string; label: string; color: string };

const BLANK: Draft = { label: '', color: '#64748b' };
// A small palette so most admins never open the color picker.
const SWATCHES = ['#8b5cf6', '#d97706', '#64748b', '#3b82f6', '#059669', '#e11d48', '#0891b2', '#7c3aed', '#ca8a04', '#475569'];

// A live preview of the reader-facing chip, so what you pick is what they see.
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className="badge cat-badge font-bold uppercase tracking-wide" style={{ '--c': color } as React.CSSProperties}>
      {label || 'Preview'}
    </span>
  );
}

export default function GenreManager({ list }: { list: G[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null); // null = editor closed
  const [saving, startSave] = useTransition();

  const active = list.filter((g) => !g.archived);
  const archived = list.filter((g) => g.archived);

  const openNew = () => setDraft({ ...BLANK });
  const openEdit = (g: G) => setDraft({ id: g.id, label: g.label, color: g.color });

  const save = () => {
    if (!draft || !draft.label.trim()) return;
    startSave(async () => {
      await saveGenre({ id: draft.id, label: draft.label, color: draft.color });
      setDraft(null);
      router.refresh();
    });
  };
  const archive = (g: G, archived: boolean) => startSave(async () => { await setGenreArchived(g.id, archived); router.refresh(); });
  const remove = (g: G) => {
    if (!confirm(`Delete the “${g.label}” genre? Articles using it will simply stop showing that badge.`)) return;
    startSave(async () => { await deleteGenre(g.id); router.refresh(); });
  };

  const editing = draft?.id ? list.find((g) => g.id === draft.id) : undefined;

  const Row = ({ g }: { g: G }) => {
    const isSponsored = g.slug === SPONSORED_GENRE;
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${g.archived ? 'border-dashed border-[var(--border)] opacity-70' : 'border-[var(--border)] bg-[var(--card)]'}`}>
        <Chip label={g.label} color={g.color} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-[var(--muted)]">
            <code>{g.slug}</code>{g.builtin && <span className="ml-1.5 rounded bg-[var(--bg-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Built-in</span>}
          </div>
        </div>
        {!g.archived && <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(g)}>Edit</button>}
        {g.archived
          ? <button type="button" className="btn-outline btn-sm" disabled={saving} onClick={() => archive(g, false)}>Restore</button>
          : isSponsored
            ? <span className="text-[11px] text-[var(--muted)]" title="Required for paid-content disclosure">Protected</span>
            : <button type="button" className="btn-outline btn-sm" disabled={saving} title="Hide from the picker (existing articles keep their badge)" onClick={() => archive(g, true)}>Archive</button>}
        {!g.builtin && (
          <button type="button" className="btn-outline btn-sm text-red-600" disabled={saving} onClick={() => remove(g)}>Delete</button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Editor card (new or editing) */}
      {draft ? (
        <div className="card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Chip label={draft.label} color={draft.color} />
            {editing && <code className="text-xs text-[var(--muted)]">{editing.slug}{editing.builtin ? ' · built-in' : ''}</code>}
          </div>
          <div>
            <label className="label" htmlFor="g-label">Label</label>
            <input id="g-label" className="input" value={draft.label} maxLength={60} autoFocus
              onChange={(e) => setDraft((d) => (d ? { ...d, label: e.target.value } : d))} placeholder="e.g. History" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              {editing ? 'The slug is fixed once created — only the label and color change here.' : 'The URL-safe slug is generated from the label (e.g. “History” → history).'}
            </p>
          </div>
          <div>
            <label className="label">Badge color</label>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setDraft((d) => (d ? { ...d, color: c } : d))}
                  className={`h-7 w-7 rounded-full border-2 transition ${draft.color.toLowerCase() === c ? 'border-[var(--fg)] ring-2 ring-offset-1' : 'border-white/60'}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={draft.color} onChange={(e) => setDraft((d) => (d ? { ...d, color: e.target.value } : d))}
                className="h-7 w-9 cursor-pointer rounded border border-[var(--border)] bg-transparent" title="Custom color" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn-primary btn-sm" disabled={saving || !draft.label.trim()} onClick={save}>
              <Check width={14} height={14} /> {draft.id ? 'Save changes' : 'Add genre'}
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setDraft(null)}><X width={14} height={14} /> Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary btn-sm" onClick={openNew}><Plus width={14} height={14} /> New genre</button>
      )}

      {/* Active list */}
      <div className="space-y-2">
        {active.length === 0 && !draft && <p className="text-sm text-[var(--muted)]">No genres yet. Add one to tag the nature of a piece.</p>}
        {active.map((g) => <Row key={g.id} g={g} />)}
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <details className="rounded-xl border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--muted)]">Archived ({archived.length})</summary>
          <div className="mt-3 space-y-2">
            {archived.map((g) => <Row key={g.id} g={g} />)}
            <p className="text-[11px] text-[var(--muted)]">Archived genres stay on any article that already uses them — they&apos;re just hidden from the picker.</p>
          </div>
        </details>
      )}
    </div>
  );
}
