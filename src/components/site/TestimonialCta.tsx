'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { submitTestimonial } from '@/lib/actions';
import { X } from '@/components/icons';

type Existing = { status: string } | null;

// The "recommend / leave a testimonial" call-to-action, shown at the bottom of a
// phone-book supplier detail page. Opening it is always a fresh submission (the
// reader writes a new testimonial that replaces any previous one and returns to
// review) — even though the button acknowledges an existing one. Deep-linked from
// the notification nudge via ?recommend=1.
export default function TestimonialCta({
  vendorId, vendorName, existing, canSubmit,
}: { vendorId: string; vendorName: string; existing: Existing; canSubmit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  useEffect(() => { if (params.get('recommend') === '1' && canSubmit) setOpen(true); }, [params, canSubmit]);

  const statusNote =
    existing?.status === 'APPROVED' ? 'Published — thank you!'
    : existing?.status === 'PENDING' ? 'Submitted — pending review.'
    : existing?.status === 'REJECTED' ? 'Not used last time — feel free to send another.'
    : '';

  function openModal() { setBody(''); setError(''); setOpen(true); }

  function save() {
    setError('');
    const fd = new FormData();
    fd.set('vendorId', vendorId);
    fd.set('body', body);
    start(async () => {
      try { await submitTestimonial(fd); setOpen(false); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    });
  }

  return (
    <section className="mt-6 border-t border-[var(--border)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Recommend {vendorName}</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {canSubmit ? 'Vouch for a supplier you use — approved testimonials may be shared with them.' : 'Add them to your Phone Book to leave a testimonial.'}
          </p>
        </div>
        {canSubmit && (
          <div className="flex items-center gap-3">
            {statusNote && <span className="text-xs font-semibold text-[var(--muted)]">{statusNote}</span>}
            <button onClick={openModal} className="btn-outline btn-sm whitespace-nowrap">★ {existing ? 'Edit your testimonial' : 'Leave a testimonial!'}</button>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{existing ? 'Write a new testimonial' : `Recommend ${vendorName}`}</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--bg-soft)]"><X width={18} height={18} /></button>
            </div>
            <p className="mb-2 text-sm text-[var(--muted)]">
              Tell other pack-and-ship stores why you recommend {vendorName}.{existing ? ' This replaces your previous testimonial and goes back to review.' : ''}
            </p>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
              placeholder={`What's it like working with ${vendorName}?`} className="input" maxLength={1500} autoFocus />
            <div className="mt-3 flex items-center justify-end gap-2">
              {error && <span className="mr-auto text-xs font-semibold text-red-500">{error}</span>}
              <button onClick={() => setOpen(false)} className="btn-outline btn-sm">Cancel</button>
              <button disabled={pending || body.trim().length < 10} onClick={save} className="btn-primary btn-sm disabled:opacity-40">Submit</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
