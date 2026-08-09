'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addSavedSupplier, removeSavedSupplier, updateSavedSupplier,
  addSupplierNote, deleteSupplierNote, submitTestimonial,
} from '@/lib/actions';
import { Star, StarFilled, Check, Plus, Trash, X } from '@/components/icons';

type Sticky = { id: string; body: string; createdAt: string | Date };
type Contact = { note: string | null; altEmail: string | null; altPhone: string | null } | null;
type Existing = { body: string; status: string } | null;

// All the interactive bits of a phone-book supplier detail page: save/unsave,
// the reader's own contacts + notes, a sticky-notes grid, and the "recommend"
// (testimonial) popup. The supplier's official info and ads are server-rendered
// on the page around this.
export default function SupplierTools({
  vendorId, vendorName, saved: savedInit, contact, sticky: stickyInit, existing,
}: { vendorId: string; vendorName: string; saved: boolean; contact: Contact; sticky: Sticky[]; existing: Existing }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(savedInit);
  const run = (fn: () => Promise<unknown>, after?: () => void) => start(async () => { try { await fn(); after?.(); router.refresh(); } catch (e) { alert(e instanceof Error ? e.message : 'Something went wrong.'); } });

  return (
    <div className="mt-5 space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { const next = !saved; setSaved(next); run(() => next ? addSavedSupplier(vendorId) : removeSavedSupplier(vendorId)); }}
          disabled={pending}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${saved ? 'border-brand-500 bg-brand-500 text-white' : 'border-[var(--border)] hover:border-brand-500 hover:text-brand-600'}`}>
          {saved ? <StarFilled width={16} height={16} /> : <Star width={16} height={16} />}
          {saved ? 'In your phone book' : 'Save to phone book'}
        </button>
        <RecommendButton vendorId={vendorId} vendorName={vendorName} existing={existing} canSubmit={saved} run={run} pending={pending} autoOpen={params.get('recommend') === '1'} />
      </div>

      {saved ? (
        <>
          <ContactEditor vendorId={vendorId} contact={contact} run={run} pending={pending} />
          <StickyNotes vendorId={vendorId} notes={stickyInit} run={run} pending={pending} />
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">Save {vendorName} to your phone book to keep your own contacts, notes, and sticky notes here.</p>
      )}
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

function RecommendButton({ vendorId, vendorName, existing, canSubmit, run, pending, autoOpen }: {
  vendorId: string; vendorName: string; existing: Existing; canSubmit: boolean;
  run: (fn: () => Promise<unknown>, after?: () => void) => void; pending: boolean; autoOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(existing?.body ?? '');
  const [done, setDone] = useState(false);
  useEffect(() => { if (autoOpen && canSubmit) setOpen(true); }, [autoOpen, canSubmit]);

  const statusNote =
    existing?.status === 'APPROVED' ? 'Published — thank you!'
    : existing?.status === 'PENDING' ? 'Submitted — pending review.'
    : existing?.status === 'REJECTED' ? 'Not used this time.'
    : '';

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:border-brand-500 hover:text-brand-600">
        ★ {existing ? 'Edit your testimonial' : 'Recommend them'}
      </button>
      {statusNote && <span className="self-center text-xs font-semibold text-[var(--muted)]">{statusNote}</span>}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">Recommend {vendorName}</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--bg-soft)]"><X width={18} height={18} /></button>
            </div>
            {!canSubmit ? (
              <p className="text-sm text-[var(--muted)]">Save {vendorName} to your phone book first — testimonials come from stores that actually use them.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-[var(--muted)]">Tell other pack-and-ship stores why you recommend them. Approved testimonials may be shared with the supplier.</p>
                <textarea value={body} onChange={(e) => { setBody(e.target.value); setDone(false); }} rows={4}
                  placeholder={`What's it like working with ${vendorName}?`} className="input" maxLength={1500} autoFocus />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="btn-outline btn-sm">Cancel</button>
                  <button disabled={pending || body.trim().length < 10}
                    onClick={() => { const fd = new FormData(); fd.set('vendorId', vendorId); fd.set('body', body); run(() => submitTestimonial(fd), () => { setDone(true); setOpen(false); }); }}
                    className="btn-primary btn-sm disabled:opacity-40">{done ? 'Saved' : existing ? 'Update' : 'Submit'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
