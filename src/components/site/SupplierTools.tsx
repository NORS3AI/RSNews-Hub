'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addSavedSupplier, updateSavedSupplier, addSupplierNote, deleteSupplierNote,
} from '@/lib/actions';
import { Star, Check, Plus, Trash } from '@/components/icons';

type Sticky = { id: string; body: string; createdAt: string | Date };
type Contact = { note: string | null; altEmail: string | null; altPhone: string | null } | null;

// The reader's own tools on a phone-book supplier detail page: their private
// contacts + notes and a sticky-notes grid. Only meaningful once the supplier is
// saved — you normally reach this page from your phone book, so it usually is.
// If you arrived unsaved (e.g. from the directory), a small "Add" appears.
export default function SupplierTools({
  vendorId, vendorName, saved, contact, sticky,
}: { vendorId: string; vendorName: string; saved: boolean; contact: Contact; sticky: Sticky[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, after?: () => void) => start(async () => { try { await fn(); after?.(); router.refresh(); } catch (e) { alert(e instanceof Error ? e.message : 'Something went wrong.'); } });

  if (!saved) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={() => run(() => addSavedSupplier(vendorId))} disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:border-brand-500 hover:text-brand-600">
          <Star width={16} height={16} /> Add to phone book
        </button>
        <span className="text-sm text-[var(--muted)]">Save {vendorName} to keep your own contacts, notes, and sticky notes here.</span>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-6">
      <ContactEditor vendorId={vendorId} contact={contact} run={run} pending={pending} />
      <StickyNotes vendorId={vendorId} notes={sticky} run={run} pending={pending} />
    </div>
  );
}

function ContactEditor({ vendorId, contact, run, pending }: { vendorId: string; contact: Contact; run: (fn: () => Promise<unknown>, after?: () => void) => void; pending: boolean }) {
  const [note, setNote] = useState(contact?.note ?? '');
  const [altEmail, setAltEmail] = useState(contact?.altEmail ?? '');
  const [altPhone, setAltPhone] = useState(contact?.altPhone ?? '');
  const [saved, setSaved] = useState(false);
  const dirty = note !== (contact?.note ?? '') || altEmail !== (contact?.altEmail ?? '') || altPhone !== (contact?.altPhone ?? '');

  return (
    <section className="rounded-xl border border-dashed border-[var(--border)] p-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Your contacts &amp; notes <span className="font-normal normal-case">(added by you — not official)</span></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={altEmail} onChange={(e) => { setAltEmail(e.target.value); setSaved(false); }} placeholder="Alt. email" className="input text-sm" />
        <input value={altPhone} onChange={(e) => { setAltPhone(e.target.value); setSaved(false); }} placeholder="Alt. phone" className="input text-sm" />
      </div>
      <textarea value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} rows={2} placeholder="Notes (rep name, account #, reminders…)" className="input mt-2 text-sm" />
      <div className="mt-2">
        <button disabled={pending || !dirty} onClick={() => run(() => updateSavedSupplier(vendorId, { note, altEmail, altPhone }), () => setSaved(true))}
          className="btn-outline btn-sm disabled:opacity-40">{saved && !dirty ? <><Check width={13} height={13} /> Saved</> : 'Save'}</button>
      </div>
    </section>
  );
}

function StickyNotes({ vendorId, notes, run, pending }: { vendorId: string; notes: Sticky[]; run: (fn: () => Promise<unknown>, after?: () => void) => void; pending: boolean }) {
  const [draft, setDraft] = useState('');
  return (
    <section>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Sticky notes</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {notes.map((n) => (
          <div key={n.id} className="group relative rounded-lg bg-amber-100 p-3 text-sm text-amber-900 shadow-sm dark:bg-amber-300/20 dark:text-amber-100">
            <p className="whitespace-pre-wrap break-words pr-4">{n.body}</p>
            <button onClick={() => run(() => deleteSupplierNote(n.id))} disabled={pending}
              title="Delete note" className="absolute right-1.5 top-1.5 rounded p-0.5 text-amber-700/60 opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:text-amber-100/60">
              <Trash width={13} height={13} />
            </button>
          </div>
        ))}
        {/* Add square */}
        <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="New note…" className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" maxLength={500} />
          <button disabled={pending || draft.trim().length === 0}
            onClick={() => run(() => addSupplierNote(vendorId, draft), () => setDraft(''))}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:opacity-40">
            <Plus width={13} height={13} /> Add
          </button>
        </div>
      </div>
    </section>
  );
}
