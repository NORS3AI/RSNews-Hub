'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Mail, Check, X, Trash } from '@/components/icons';

// One Subscribe popup, used everywhere. Two scopes, because a hub login is shared
// by a whole store: on-site notifications are ACCOUNT-WIDE (one shared bell),
// email digests are PER-ADDRESS (any employee can add their own inbox).
//
// Open it from anywhere by dispatching:
//   window.dispatchEvent(new CustomEvent('rsnews:subscribe-open', { detail }))
//   detail?: { preselect?: string; email?: string; topics?: string[] }
//     preselect  — a topic key to pre-check (e.g. the category you're viewing)
//     email+topics — "Customize" an existing digest email (edit-one mode)

type Topic = { key: string; name: string; color: string; count?: number };
type Menu = { industry: Topic; categories: Topic[] };
type EmailRow = { id: string; email: string; topics: string[] };
export const SUBSCRIBE_EVENT = 'rsnews:subscribe-open';
export const NOTIF_CHANGED = 'rsnews:notifications-changed';

export default function SubscribePopup() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'default' | 'editEmail'>('default');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set(['industry']));
  const [notifyOn, setNotifyOn] = useState(true);
  const [emailOn, setEmailOn] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true); // master email-digest switch (admin)
  const [emailAddr, setEmailAddr] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [accountEmail, setAccountEmail] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/subscriptions');
    if (!res.ok) return null;
    return res.json();
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      setNote(null); setConfirmDel(null);
      setOpen(true);
      load().then((d) => {
        if (!d) { setNote({ ok: false, text: 'Please sign in to subscribe.' }); return; }
        setMenu(d.menu); setEmails(d.emails); setAccountEmail(d.accountEmail);
        setEmailEnabled(d.emailDigestEnabled !== false);
        if (detail.email) {
          // "Customize" an existing digest email — edit just that address.
          setMode('editEmail'); setEmailLocked(true); setEmailOn(true);
          setEmailAddr(detail.email); setNotifyOn(false);
          setChecked(new Set(detail.topics?.length ? detail.topics : ['industry']));
        } else {
          setMode('default'); setEmailLocked(false); setEmailOn(false); setEmailAddr('');
          const base: string[] = d.notifyTopics?.length ? d.notifyTopics : ['industry'];
          if (detail.preselect) base.push(detail.preselect);
          setChecked(new Set(base));
          // Reflect existing state: ON only if the account already has notification
          // topics, or the user explicitly clicked a "Subscribe" button (preselect).
          // This stops a "just add an email" visit from creating/altering the
          // shared, account-wide bell by accident.
          setNotifyOn((d.notifyTopics?.length ?? 0) > 0 || !!detail.preselect);
        }
      }).catch(() => setNote({ ok: false, text: 'Could not load — check your connection and try again.' }));
    }
    window.addEventListener(SUBSCRIBE_EVENT, onOpen);
    return () => window.removeEventListener(SUBSCRIBE_EVENT, onOpen);
  }, [load]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function toggle(key: string) {
    setChecked((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  async function save() {
    if (busy) return;
    const topics = Array.from(checked);
    if (mode === 'editEmail') {
      setBusy(true);
      try {
        const res = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'email', email: emailAddr, topics }) });
        if (res.ok) { setNote({ ok: true, text: 'Updated.' }); window.dispatchEvent(new Event(NOTIF_CHANGED)); setTimeout(() => setOpen(false), 700); }
        else setNote({ ok: false, text: (await res.json()).error || 'Could not save.' });
      } finally { setBusy(false); }
      return;
    }
    if (!notifyOn && !(emailOn && emailAddr.trim())) { setNote({ ok: false, text: 'Pick a delivery: on-site notifications, email, or both.' }); return; }
    setBusy(true); setNote(null);
    try {
      // Account-wide notifications: only WRITE when the toggle is on, so turning
      // it off (or opening just to add an email) never wipes the shared bell for
      // the whole store. To clear notifications, uncheck all topics with the
      // toggle on and save — that's the one explicit path to an empty set.
      if (notifyOn) {
        await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notify', topics }) });
      }
      // Personal email digest for this address.
      let emailErr = '';
      if (emailOn && emailAddr.trim()) {
        const res = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'email', email: emailAddr, topics }) });
        if (!res.ok) emailErr = (await res.json()).error || 'Email address looks off.';
      }
      const d = await load();
      if (d) { setEmails(d.emails); }
      window.dispatchEvent(new Event(NOTIF_CHANGED));
      if (emailErr) setNote({ ok: false, text: emailErr });
      else { setNote({ ok: true, text: emailOn && emailAddr.trim() ? `Saved — ${emailAddr.trim()} is on the list.` : 'Saved to your notifications.' }); setEmailOn(false); setEmailAddr(''); }
    } finally { setBusy(false); }
  }

  async function removeEmail(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'removeEmail', id }) });
      setConfirmDel(null);
      const d = await load(); if (d) setEmails(d.emails);
      window.dispatchEvent(new Event(NOTIF_CHANGED)); // keep the page's list + sidebar in sync
    } finally { setBusy(false); }
  }

  if (!open) return null;
  const cats = menu?.categories || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-[6vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Subscribe" className="card w-full max-w-lg p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-black">{mode === 'editEmail' ? 'Customize this email' : 'Subscribe'}</h2>
          <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]" aria-label="Close"><X width={18} height={18} /></button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-5 py-4">
          <p className="mb-3 text-sm text-[var(--muted)]">
            {mode === 'editEmail'
              ? <>Choose what <strong>{emailAddr}</strong> receives.</>
              : emailEnabled
                ? 'Pick the topics you care about, then choose how you want them.'
                : 'Pick the topics you care about to get them in your on-site notifications.'}
          </p>

          {/* Topic checklist — Industry News pinned first, then categories. */}
          <div className="space-y-1.5">
            {menu && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <input type="checkbox" checked={checked.has('industry')} onChange={() => toggle('industry')} className="h-[18px] w-[18px] accent-brand-600" />
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: menu.industry.color }} />
                <span className="font-bold">Industry News</span>
                <span className="ml-auto text-xs text-[var(--muted)]">Brandon&apos;s daily posts</span>
              </label>
            )}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {cats.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-2)]">
                  <input type="checkbox" checked={checked.has(c.key)} onChange={() => toggle(c.key)} className="h-[17px] w-[17px] accent-brand-600" />
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery */}
          {mode === 'default' ? (
            <div className="mt-4 space-y-2.5">
              <button type="button" onClick={() => setNotifyOn((v) => !v)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${notifyOn ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-[var(--border)]'}`}>
                <Bell width={19} height={19} className="text-brand-600" />
                <span className="min-w-0"><span className="block text-sm font-bold">On-site notifications</span><span className="block text-xs text-[var(--muted)]">Your selections pop up in your notifications here on the RS News Hub.</span></span>
                <span className={`ml-auto grid h-5 w-5 place-items-center rounded-md border ${notifyOn ? 'border-brand-600 bg-brand-600 text-white' : 'border-[var(--border)]'}`}>{notifyOn && <Check width={13} height={13} />}</span>
              </button>

              {/* Email digest — hidden entirely when an admin has turned the
                  feature off (on-site notifications above still work). */}
              {emailEnabled && (
              <div className={`rounded-xl border px-3 py-2.5 ${emailOn ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-[var(--border)]'}`}>
                <button type="button" onClick={() => setEmailOn((v) => !v)} className="flex w-full items-center gap-3 text-left">
                  <Mail width={19} height={19} className="text-brand-600" />
                  <span className="min-w-0"><span className="block text-sm font-bold">Email a copy</span><span className="block text-xs text-[var(--muted)]">Add an email to get your selections when they&apos;re posted. Sent once daily.</span></span>
                  <span className={`ml-auto grid h-5 w-5 place-items-center rounded-md border ${emailOn ? 'border-brand-600 bg-brand-600 text-white' : 'border-[var(--border)]'}`}>{emailOn && <Check width={13} height={13} />}</span>
                </button>
                {emailOn && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input type="email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} placeholder="you@yourstore.com" className="input flex-1" />
                    {accountEmail && emailAddr !== accountEmail && (
                      <button type="button" onClick={() => setEmailAddr(accountEmail)} className="btn-outline btn-sm whitespace-nowrap">Use account email</button>
                    )}
                    <p className="w-full text-xs text-[var(--muted)]">We&apos;ll only use it for the updates you pick. See our <Link href="/docs/page/privacy" className="text-brand-600 underline">Privacy Policy</Link>.</p>
                  </div>
                )}
              </div>
              )}
            </div>
          ) : null}

          {note && <p className={`mt-3 text-sm font-semibold ${note.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{note.text}</p>}

          {/* Manage: emails this account has added (default mode only, and only
              while the digest feature is on). */}
          {mode === 'default' && emailEnabled && emails.length > 0 && (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Your emails subscribed to RS News Hub ({emails.length})</div>
              <div className="space-y-1.5">
                {emails.map((em) => (
                  <div key={em.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{em.email}</div>
                      <div className="truncate text-xs text-[var(--muted)]">{em.topics.includes('all') ? 'Everything' : em.topics.map((t) => t === 'industry' ? 'Industry News' : (cats.find((c) => c.key === t)?.name || t)).join(', ') || 'Industry News'}</div>
                    </div>
                    <button onClick={() => window.dispatchEvent(new CustomEvent(SUBSCRIBE_EVENT, { detail: { email: em.email, topics: em.topics } }))} className="btn-outline btn-sm">Customize</button>
                    {confirmDel === em.id ? (
                      <button onClick={() => removeEmail(em.id)} className="btn-sm font-bold text-red-600 hover:underline">Remove</button>
                    ) : (
                      <button onClick={() => setConfirmDel(em.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Remove email"><Trash width={16} height={16} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5">
          <button onClick={() => setOpen(false)} className="btn-ghost btn-sm">Close</button>
          <button onClick={save} disabled={busy || checked.size === 0} className="btn-primary btn-sm">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
