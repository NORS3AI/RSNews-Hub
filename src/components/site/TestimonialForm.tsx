'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitTestimonial } from '@/lib/actions';
import { Check } from '@/components/icons';

type Existing = { body: string; status: string } | null;

// Reader-facing "leave a testimonial" box on a supplier page. Anchored at
// #testimonial so the notification nudge can deep-link straight to it. Only
// savers can submit (matches who gets nudged); everyone else sees a gentle hint.
export default function TestimonialForm({
  vendorId, vendorName, signedIn, isSaver, existing, highlighted,
}: { vendorId: string; vendorName: string; signedIn: boolean; isSaver: boolean; existing: Existing; highlighted: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState(existing?.body ?? '');
  const [pending, start] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');

  const statusNote =
    existing?.status === 'APPROVED' ? 'Published — thank you!'
    : existing?.status === 'PENDING' ? 'Submitted — pending review.'
    : existing?.status === 'REJECTED' ? 'Not published this time.'
    : '';

  function save() {
    setError('');
    const fd = new FormData();
    fd.set('vendorId', vendorId);
    fd.set('body', body);
    start(async () => {
      try {
        await submitTestimonial(fd);
        setJustSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save.');
      }
    });
  }

  return (
    <section id="testimonial" className={`mt-6 module scroll-mt-24 ${highlighted ? 'ring-2 ring-brand-500' : ''}`}>
      <h2 className="text-lg font-bold">Recommend {vendorName}</h2>

      {!signedIn ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link> to share your experience with this supplier.
        </p>
      ) : !isSaver ? (
        <p className="mt-1 text-sm text-[var(--muted)]">Add {vendorName} to your phone book (the star above) to leave a testimonial — testimonials come from stores that actually use them.</p>
      ) : (
        <div className="mt-2">
          <p className="mb-2 text-sm text-[var(--muted)]">Tell other pack-and-ship stores why you recommend them. We may feature approved testimonials on their supplier page.</p>
          <textarea value={body} onChange={(e) => { setBody(e.target.value); setJustSaved(false); }} rows={3}
            placeholder={`What's it like working with ${vendorName}?`} className="input" maxLength={1500} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={pending || body.trim().length < 10}
              className="btn-primary btn-sm disabled:opacity-40">
              {justSaved ? <><Check width={14} height={14} /> Saved</> : existing ? 'Update testimonial' : 'Submit testimonial'}
            </button>
            {statusNote && !justSaved && (
              <span className={`text-xs font-semibold ${existing?.status === 'APPROVED' ? 'text-green-600' : existing?.status === 'REJECTED' ? 'text-[var(--muted)]' : 'text-amber-600'}`}>{statusNote}</span>
            )}
            {justSaved && <span className="text-xs font-semibold text-amber-600">Submitted — pending review.</span>}
            {error && <span className="text-xs font-semibold text-red-500">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
