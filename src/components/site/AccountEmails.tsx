'use client';
import { useEffect, useState, useCallback } from 'react';
import { Mail, Trash, Plus } from '@/components/icons';
import { SUBSCRIBE_EVENT, NOTIF_CHANGED } from './SubscribePopup';

type EmailRow = { id: string; email: string; topics: string[] };
type Cat = { key: string; name: string };

/** Manage the digest emails this account has added: see who's on the list, edit
 *  their topics ("Customize"), or remove them with a confirm step. */
export default function AccountEmails() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/subscriptions');
    if (!res.ok) { setLoaded(true); return; }
    const d = await res.json();
    setEmails(d.emails ?? []); setCats(d.menu?.categories ?? []); setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(NOTIF_CHANGED, onChange);
    return () => window.removeEventListener(NOTIF_CHANGED, onChange);
  }, [load]);

  const topicLabel = (t: string) => t === 'all' ? 'Everything' : t === 'industry' ? 'Industry News' : (cats.find((c) => c.key === t)?.name || t);

  const [removing, setRemoving] = useState(false);
  async function remove(id: string) {
    if (removing) return;
    setRemoving(true);
    try {
      await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'removeEmail', id }) });
      setConfirmDel(null); await load();
    } finally { setRemoving(false); }
  }
  const openAdd = () => window.dispatchEvent(new CustomEvent(SUBSCRIBE_EVENT, { detail: {} }));
  const customize = (em: EmailRow) => window.dispatchEvent(new CustomEvent(SUBSCRIBE_EVENT, { detail: { email: em.email, topics: em.topics } }));

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Mail width={18} height={18} className="text-brand-600" /> Your emails subscribed to RS News Hub</h2>
        <button onClick={openAdd} className="btn-primary btn-sm"><Plus width={15} height={15} /> Add email</button>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">These emails are signed up for specific subscriptions — customize, remove, or add another. All emails and their customizations feed into the notifications you get here.</p>

      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : emails.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">No emails added yet.</p>
      ) : (
        <div className="space-y-2">
          {emails.map((em) => (
            <div key={em.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{em.email}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(em.topics.length ? em.topics : ['industry']).map((t) => (
                    <span key={t} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">{topicLabel(t)}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => customize(em)} className="btn-outline btn-sm">Customize</button>
              {confirmDel === em.id ? (
                <>
                  <button onClick={() => remove(em.id)} className="btn-sm font-bold text-red-600 hover:underline">Remove now</button>
                  <button onClick={() => setConfirmDel(null)} className="btn-ghost btn-sm">Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(em.id)} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Remove email"><Trash width={16} height={16} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
