'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Admin controls: send today's digest to everyone, or a test to one address. */
export default function NewsletterAdmin({ emailReady }: { emailReady: boolean }) {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'test'>('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendNow() {
    if (busy) return;
    if (!confirm('Send today’s Industry News digest to all active subscribers now?')) return;
    setBusy('send'); setNote(null);
    try {
      const res = await fetch('/api/admin/newsletter/send', { method: 'POST' });
      const d = await res.json();
      if (d.sent === 0 && d.failed === 0) setNote({ ok: true, text: `Nothing new for anyone — no emails went out (${d.skippedEmpty} subscriber${d.skippedEmpty === 1 ? '' : 's'} had no new items).` });
      else setNote({ ok: true, text: `Sent ${d.sent} personalized digest${d.sent === 1 ? '' : 's'}${d.failed ? ` (${d.failed} failed)` : ''}${d.skippedEmpty ? ` · ${d.skippedEmpty} skipped (nothing new)` : ''}.` });
      router.refresh();
    } catch { setNote({ ok: false, text: 'Send failed — try again.' }); }
    finally { setBusy(''); }
  }

  async function sendTest() {
    if (busy || !testEmail.trim()) return;
    setBusy('test'); setNote(null);
    try {
      const res = await fetch('/api/admin/newsletter/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testEmail.trim() }) });
      const d = await res.json();
      if (!res.ok) setNote({ ok: false, text: d.error || 'Test failed.' });
      else if (d.skipped) setNote({ ok: true, text: `Composed a test, but email isn’t configured yet — it was logged, not sent. Set EMAIL_FROM + SENDGRID_API_KEY to send for real.` });
      else setNote({ ok: true, text: `Test digest sent to ${testEmail.trim()}.` });
    } catch { setNote({ ok: false, text: 'Test failed — try again.' }); }
    finally { setBusy(''); }
  }

  return (
    <div className="space-y-3">
      {!emailReady && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Email isn’t configured, so digests are <strong>logged, not sent</strong>. Set <code>EMAIL_FROM</code> + <code>SENDGRID_API_KEY</code> on the host to go live.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={sendNow} disabled={!!busy} className="btn-primary btn-sm">{busy === 'send' ? 'Sending…' : "Send today's digest"}</button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="label">Send a test to one address</label>
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} type="email" placeholder="you@example.com" className="input" />
        </div>
        <button onClick={sendTest} disabled={!!busy || !testEmail.trim()} className="btn-outline btn-sm">{busy === 'test' ? 'Sending…' : 'Send test'}</button>
      </div>
      {note && <p className={`text-sm ${note.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{note.text}</p>}
    </div>
  );
}
