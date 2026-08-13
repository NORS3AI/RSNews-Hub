'use client';
import { useState } from 'react';
import { useScrollLock } from '@/lib/useScrollLock';
import { X, Check } from '@/components/icons';

// Shown at the top of a DRAFT article opened via a valid ?preview=<token> link.
// A clear "not published" banner plus a review action: an invited reviewer gives
// their first + last name and either approves or requests changes (long free
// text). Responses aggregate in the Hub. The link itself is the access control;
// the name is for attribution.
export default function PreviewReviewBar({ slug, token }: { slug: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'approve' | 'change'>('approve');
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'approve' | 'change'>(null);
  const [error, setError] = useState('');
  useScrollLock(open);

  const canSubmit = firstName.trim() && lastName.trim() && (mode === 'approve' || message.trim());

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/articles/${encodeURIComponent(slug)}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firstName, lastName, decision: mode, message }),
      });
      if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || 'Could not send your review.'); }
      setDone(mode);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      {/* Unmissable "this is a draft" strip. */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-2 text-center text-amber-950">
        <span className="text-sm font-black uppercase tracking-wide">Preview — not yet published</span>
        <span className="text-sm">This is a private draft shared with you for review.</span>
        <button onClick={() => { setDone(null); setOpen(true); }} className="rounded-full bg-amber-950 px-4 py-1 text-sm font-bold text-amber-50 hover:bg-amber-900">
          Click here to approve or request changes
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Review this draft" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--bg-soft)]" aria-label="Close"><X /></button>

            {done ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-700"><Check width={26} height={26} /></div>
                <h2 className="text-xl font-black">{done === 'approve' ? 'Thanks — approval sent!' : 'Thanks — your change request was sent.'}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{firstName}, the team has your response. You can close this tab.</p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-black">Review this draft</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Your name is recorded with your response so the team knows who reviewed it.</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block"><span className="label">First name</span><input className="input" value={firstName} onChange={(e) => setFirst(e.target.value)} maxLength={60} autoComplete="given-name" /></label>
                  <label className="block"><span className="label">Last name</span><input className="input" value={lastName} onChange={(e) => setLast(e.target.value)} maxLength={60} autoComplete="family-name" /></label>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMode('approve')} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${mode === 'approve' ? 'border-green-500 bg-green-50 text-green-800' : 'border-[var(--border)] text-[var(--muted)]'}`}>✓ Approve</button>
                  <button type="button" onClick={() => setMode('change')} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${mode === 'change' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-[var(--border)] text-[var(--muted)]'}`}>✎ Request changes</button>
                </div>

                {mode === 'change' && (
                  <label className="mt-3 block">
                    <span className="label">What would you like changed?</span>
                    <textarea className="input min-h-[160px] resize-y" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={8000} placeholder="Be as detailed as you like — headline tweaks, image swaps, corrections, anything." />
                    <span className="mt-1 block text-xs text-[var(--muted)]">{message.length}/8000</span>
                  </label>
                )}

                {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}

                <div className="mt-4 flex items-center gap-2">
                  <button onClick={submit} disabled={!canSubmit || busy} className="btn-primary btn-sm disabled:opacity-50">{busy ? 'Sending…' : mode === 'approve' ? 'Send approval' : 'Send change request'}</button>
                  <button onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
