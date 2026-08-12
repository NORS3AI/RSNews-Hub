'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setDigestEnabled } from '@/lib/actions';

/** Admin controls: send today's digest to everyone, or a test to one address. */
export default function NewsletterAdmin({ emailReady, enabled }: { emailReady: boolean; enabled: boolean }) {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'test' | 'toggle'>('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggleEnabled() {
    if (busy) return;
    const turningOff = enabled;
    if (turningOff && !confirm('Turn OFF the email digest for the whole site? No digests will send and readers will no longer see the “email a copy” option (on-site notifications keep working).')) return;
    setBusy('toggle'); setNote(null);
    try {
      await setDigestEnabled(!enabled);
      router.refresh();
    } catch { setNote({ ok: false, text: 'Could not change the setting — try again.' }); }
    finally { setBusy(''); }
  }

  async function sendNow() {
    if (busy) return;
    if (!confirm('Send today’s Industry News digest to all active subscribers now?')) return;
    setBusy('send'); setNote(null);
    try {
      const res = await fetch('/api/admin/newsletter/send', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setNote({ ok: false, text: d.error || 'Send failed — try again.' }); return; }
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
      {/* Master on/off for the whole email-digest feature. */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Email digest {enabled ? 'is on' : 'is off'}</div>
          <div className="text-xs text-[var(--muted)]">{enabled ? 'Subscribers can get the daily email; the reader subscribe box offers it.' : 'Paused — nothing emails, and readers only see on-site notifications.'}</div>
        </div>
        <button onClick={toggleEnabled} disabled={!!busy}
          className={`btn-sm shrink-0 ${enabled ? 'btn-outline' : 'btn-primary'}`}>
          {busy === 'toggle' ? '…' : enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {!enabled ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          The email digest is turned off, so sending is disabled. Turn it back on above to resume.
        </p>
      ) : (
        <>
      {!emailReady && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Email isn’t configured, so digests are <strong>logged, not sent</strong>. Set <code>EMAIL_FROM</code> + <code>SENDGRID_API_KEY</code> on the host to go live.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={sendNow} disabled={!!busy} className="btn-primary btn-sm">{busy === 'send' ? 'Sending…' : "Send today's digest"}</button>
      </div>
      {/* The scheduled nightly job also sends. If you push manually right around
          that time, subscribers can get the digest twice. */}
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        ⚠︎ Heads-up: the digest also sends automatically each night. Sending manually now (especially near that scheduled time, or clicking twice) can deliver the same digest <strong>twice</strong>. Use this mainly when the nightly send is off or you know it hasn’t run.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="label">Send a test to one address</label>
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} type="email" placeholder="you@example.com" className="input" />
        </div>
        <button onClick={sendTest} disabled={!!busy || !testEmail.trim()} className="btn-outline btn-sm">{busy === 'test' ? 'Sending…' : 'Send test'}</button>
      </div>
        </>
      )}
      {note && <p className={`text-sm ${note.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{note.text}</p>}
    </div>
  );
}
