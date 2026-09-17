'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadImage } from '@/lib/uploadClient';
import { saveByline, setBylineArchived } from '@/lib/actions';
import { bylineInitials } from '@/lib/byline';
import { Plus, Check, X } from '@/components/icons';

type B = { id: string; name: string; title: string | null; photo: string | null; bio: string | null; archived: boolean };
type Draft = { id?: string; name: string; title: string; photo: string | null; bio: string };

const BLANK: Draft = { name: '', title: '', photo: null, bio: '' };

// A round avatar — the same shape readers see. Any uploaded image is centered
// and cropped to the circle, so no specific size is ever required.
function Avatar({ name, photo, size = 44 }: { name: string; photo: string | null; size?: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid shrink-0 rounded-full bg-brand-600/15 font-bold text-brand-700 dark:text-brand-300"
      style={{ width: size, height: size, placeItems: 'center', fontSize: size * 0.34 }}>
      {bylineInitials(name) || '—'}
    </span>
  );
}

export default function BylineManager({ list }: { list: B[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null); // null = editor closed
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const active = list.filter((b) => !b.archived);
  const archived = list.filter((b) => b.archived);

  const openNew = () => setDraft({ ...BLANK });
  const openEdit = (b: B) => setDraft({ id: b.id, name: b.name, title: b.title ?? '', photo: b.photo, bio: b.bio ?? '' });

  const pickPhoto = async (file: File) => {
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (res.ok) setDraft((d) => (d ? { ...d, photo: res.url } : d));
    else alert(res.error);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    startSave(async () => {
      await saveByline({ id: draft.id, name: draft.name, title: draft.title, photo: draft.photo, bio: draft.bio });
      setDraft(null);
      router.refresh();
    });
  };

  const archive = (b: B, archived: boolean) => startSave(async () => { await setBylineArchived(b.id, archived); router.refresh(); });

  return (
    <div className="space-y-5">
      {/* Editor card (new or editing) */}
      {draft ? (
        <div className="card space-y-3 p-4">
          <div className="flex items-center gap-4">
            <Avatar name={draft.name} photo={draft.photo} size={56} />
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }} />
              <div className="flex items-center gap-2">
                <button type="button" className="btn-outline btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? 'Uploading…' : draft.photo ? 'Replace photo' : 'Add photo'}
                </button>
                {draft.photo && (
                  <button type="button" className="btn-outline btn-sm" onClick={() => setDraft((d) => (d ? { ...d, photo: null } : d))}>Remove</button>
                )}
              </div>
              <p className="text-[11px] text-[var(--muted)]">Any size — we crop it to a circle. Optional; without one the byline shows just the name.</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="b-name">Name</label>
            <input id="b-name" className="input" value={draft.name} maxLength={120} autoFocus
              onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))} placeholder="e.g. Brandon Gale" />
          </div>
          <div>
            <label className="label" htmlFor="b-title">Title <span className="font-normal text-[var(--muted)]">(optional)</span></label>
            <input id="b-title" className="input" value={draft.title} maxLength={120}
              onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))} placeholder="e.g. President, RS News" />
          </div>
          <div>
            <label className="label" htmlFor="b-bio">Bio <span className="font-normal text-[var(--muted)]">(optional)</span></label>
            <textarea id="b-bio" className="input min-h-[72px]" value={draft.bio} maxLength={600}
              onChange={(e) => setDraft((d) => (d ? { ...d, bio: e.target.value } : d))} placeholder="A sentence or two — shown in the in-article author card." />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Only appears in the in-article Author card element, never in the little top byline.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn-primary btn-sm" disabled={saving || uploading || !draft.name.trim()} onClick={save}>
              <Check width={14} height={14} /> {draft.id ? 'Save changes' : 'Add byline'}
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setDraft(null)}><X width={14} height={14} /> Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary btn-sm" onClick={openNew}><Plus width={14} height={14} /> New byline</button>
      )}

      {/* Active list */}
      <div className="space-y-2">
        {active.length === 0 && !draft && <p className="text-sm text-[var(--muted)]">No saved bylines yet. Add one to attach a named author (with a photo) to an article.</p>}
        {active.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <Avatar name={b.name} photo={b.photo} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{b.name}</div>
              {b.title && <div className="truncate text-xs text-[var(--muted)]">{b.title}</div>}
            </div>
            <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(b)}>Edit</button>
            <button type="button" className="btn-outline btn-sm" title="Hide from the picker (keeps existing articles unchanged)"
              disabled={saving} onClick={() => archive(b, true)}>Archive</button>
          </div>
        ))}
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <details className="rounded-xl border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--muted)]">Archived ({archived.length})</summary>
          <div className="mt-3 space-y-2">
            {archived.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-3 opacity-70">
                <Avatar name={b.name} photo={b.photo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{b.name}</div>
                  {b.title && <div className="truncate text-xs text-[var(--muted)]">{b.title}</div>}
                </div>
                <button type="button" className="btn-outline btn-sm" disabled={saving} onClick={() => archive(b, false)}>Restore</button>
              </div>
            ))}
            <p className="text-[11px] text-[var(--muted)]">Archived bylines stay on any article that already uses them — they&apos;re just hidden from the picker.</p>
          </div>
        </details>
      )}
    </div>
  );
}
