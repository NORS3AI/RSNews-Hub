'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveAnnouncementMessage, deleteAnnouncementMessage, toggleAnnouncementStar,
  showAnnouncementMessage, setAnnouncementBarEnabled,
} from '@/lib/actions';
import type { AnnouncementRecord, AnnSize, AnnElement } from '@/lib/announcement';

type Draft = {
  id?: string; name: string; message: string; href: string; hrefLabel: string;
  size: AnnSize; ticker: boolean; showCountdown: boolean; targetAt: string; order: AnnElement[]; audience: string;
};
const EMPTY: Draft = { name: '', message: '', href: '', hrefLabel: '', size: 'md', ticker: false, showCountdown: false, targetAt: '', order: ['message', 'countdown', 'button'], audience: '' };
const LABEL: Record<AnnElement, string> = { message: 'Message', countdown: 'Countdown', button: 'Button' };
// Audience gate options — value is the entitlement token stored on the record.
const AUDIENCES: { value: string; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'packagehub', label: 'PackageHub members only' },
  { value: 'premium', label: 'RS Premium members only' },
  { value: 'member', label: 'Signed-in members only' },
  { value: 'vendor', label: 'Vendors only' },
  { value: 'staff', label: 'Staff only' },
];
const audienceLabel = (v: string) => AUDIENCES.find((a) => a.value === v)?.label ?? v;

export default function AnnouncementManager({ list, enabled, liveId }: { list: AnnouncementRecord[]; enabled: boolean; liveId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) { setBusy(true); try { await fn(); router.refresh(); } finally { setBusy(false); } }
  function editExisting(r: AnnouncementRecord) {
    setDraft({ id: r.id, name: r.name, message: r.message, href: r.href, hrefLabel: r.hrefLabel, size: r.size, ticker: r.ticker, showCountdown: r.showCountdown, targetAt: r.targetAt ? r.targetAt.slice(0, 16) : '', order: r.order, audience: r.audience });
  }
  async function save() {
    if (!draft || !draft.message.trim()) return;
    await run(() => saveAnnouncementMessage({ ...draft, targetAt: draft.targetAt || null, order: draft.order.join(',') }));
    setDraft(null);
  }
  function moveEl(i: number, dir: -1 | 1) {
    if (!draft) return;
    const o = [...draft.order]; const j = i + dir; if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; setDraft({ ...draft, order: o });
  }

  return (
    <div className="space-y-5">
      {/* Master on/off */}
      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="font-semibold">Announcement bar is {enabled ? 'ON' : 'OFF'}</div>
          <div className="text-xs text-[var(--muted)]">{enabled ? (liveId ? 'Showing the live message below.' : 'On, but no message is set to show — pick one with “Show”.') : 'Nothing shows on the site until you turn this on.'}</div>
        </div>
        <button onClick={() => run(() => setAnnouncementBarEnabled(!enabled))} disabled={busy} className={`btn-sm ${enabled ? 'btn-outline' : 'btn-primary'}`}>{enabled ? 'Turn off' : 'Turn on'}</button>
      </div>

      {/* Editor */}
      {draft ? (
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{draft.id ? 'Edit message' : 'New message'}</h2>
            <span className="text-xs text-[var(--muted)]">Saving only edits the library — it doesn’t turn the bar on or change which message is live.</span>
          </div>

          <AnnPreview draft={draft} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Library name (optional)"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Expo teaser, System down" /></Field>
            <Field label="Size"><select className="input" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value as AnnSize })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></Field>
          </div>
          <Field label="Message"><input className="input" value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} maxLength={200} placeholder="RS Expo 2026 — the industry's biggest weekend" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Button link (optional)"><input className="input" value={draft.href} onChange={(e) => setDraft({ ...draft, href: e.target.value })} placeholder="/docs/page/expo" /></Field>
            <Field label="Button text"><input className="input" value={draft.hrefLabel} onChange={(e) => setDraft({ ...draft, hrefLabel: e.target.value })} maxLength={40} placeholder="Register" /></Field>
          </div>

          <Field label="Who sees this"><select className="input" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}>{AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>{draft.audience && <span className="mt-1 block text-xs text-[var(--muted)]">Only {audienceLabel(draft.audience).replace(/ only$/, '')} will ever see this bar — everyone else gets nothing (it’s filtered server-side, never sent to their browser).</span>}</Field>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={draft.showCountdown} onChange={(e) => setDraft({ ...draft, showCountdown: e.target.checked })} /> Show a live countdown</label>
          {draft.showCountdown && <Field label="Count down to"><input type="datetime-local" className="input max-w-xs" value={draft.targetAt} onChange={(e) => setDraft({ ...draft, targetAt: e.target.value })} /></Field>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={draft.ticker} onChange={(e) => setDraft({ ...draft, ticker: e.target.checked })} /> Scroll the message as a ticker (countdown &amp; button stay put)</label>

          <div>
            <div className="label">Order</div>
            <div className="flex flex-wrap gap-2">
              {draft.order.map((el, i) => (
                <span key={el} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-2 py-1 text-sm">
                  <button type="button" disabled={i === 0} onClick={() => moveEl(i, -1)} className="disabled:opacity-30" aria-label="Move left">◀</button>
                  <span className="font-semibold">{LABEL[el]}</span>
                  <button type="button" disabled={i === draft.order.length - 1} onClick={() => moveEl(i, 1)} className="disabled:opacity-30" aria-label="Move right">▶</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={busy || !draft.message.trim()} className="btn-primary btn-sm">Save to library</button>
            <button onClick={() => setDraft(null)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ ...EMPTY })} className="btn-primary btn-sm">+ New message</button>
      )}

      {/* Library */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Saved messages ({list.length})</div>
        {list.length === 0 && <p className="text-sm text-[var(--muted)]">No saved messages yet. Create one above — starred ones (⭐) rise to the top so you can reuse them.</p>}
        {list.map((r) => {
          const isLive = r.id === liveId;
          return (
            <div key={r.id} className={`card flex flex-wrap items-center gap-3 p-3 ${isLive ? 'ring-2 ring-brand-500' : ''}`}>
              <button onClick={() => run(() => toggleAnnouncementStar(r.id))} disabled={busy} title={r.starred ? 'Unstar' : 'Star for reuse'} className="shrink-0 text-lg leading-none">{r.starred ? '⭐' : '☆'}</button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.message || <span className="text-[var(--muted)]">(empty)</span>}</div>
                <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-[var(--muted)]">
                  {r.name && <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5 font-semibold">{r.name}</span>}
                  <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5">{r.size.toUpperCase()}</span>
                  {r.showCountdown && <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5">⏱ countdown</span>}
                  {r.ticker && <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5">ticker</span>}
                  {r.href && <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5">button</span>}
                  {r.audience && <span className="rounded bg-brand-100 px-1.5 py-0.5 font-semibold text-brand-700">🔒 {audienceLabel(r.audience).replace(/ only$/, '')}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isLive ? <span className="badge bg-brand-600 text-white">● Live</span>
                  : <button onClick={() => run(() => showAnnouncementMessage(r.id))} disabled={busy} className="btn-outline btn-sm">Show this</button>}
                <button onClick={() => editExisting(r)} className="btn-ghost btn-sm">Edit</button>
                <button onClick={() => { if (confirm('Delete this saved message?')) run(() => deleteAnnouncementMessage(r.id)); }} disabled={busy} className="btn-ghost btn-sm text-red-600">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

// A static, non-dismissible preview of how the bar will look (size + order).
function AnnPreview({ draft }: { draft: Draft }) {
  const size = draft.size === 'sm' ? 'py-1.5 text-sm' : draft.size === 'lg' ? 'py-3.5 text-base' : 'py-2.5 text-[15px]';
  const els: Record<AnnElement, React.ReactNode> = {
    message: <span key="m" className="font-semibold">{draft.message || 'Your message'}</span>,
    countdown: draft.showCountdown ? <span key="c" className="rounded-full bg-white/15 px-2.5 py-0.5 font-extrabold tabular-nums">12d 03h 45m 10s</span> : null,
    button: draft.href ? <span key="b" className="rounded-full bg-white px-3 py-0.5 font-bold text-brand-700">{draft.hrefLabel || 'Learn more'} →</span> : null,
  };
  return (
    <div>
      <div className="mb-1 text-xs text-[var(--muted)]">Preview</div>
      <div className={`flex flex-wrap items-center justify-center gap-3 rounded-lg bg-brand-600 px-4 text-white ${size}`}>
        <span aria-hidden>📣</span>
        {draft.order.map((k) => els[k]).filter(Boolean)}
      </div>
    </div>
  );
}
