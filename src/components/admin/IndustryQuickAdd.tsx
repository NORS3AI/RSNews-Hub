'use client';
import { useState } from 'react';
import { saveIndustryLink } from '@/lib/actions';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/**
 * Smart Industry News entry: paste ONE link, hit "Fetch details", and the
 * headline, source and date fill themselves in from the page's meta tags.
 * Everything stays editable, and it still saves through the normal action.
 */
export default function IndustryQuickAdd() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [postedAt, setPostedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function fetchMeta() {
    if (!url.trim()) { setNote({ kind: 'err', text: 'Paste a link first.' }); return; }
    setBusy(true); setNote(null);
    try {
      const res = await fetch(`/api/admin/industry/metadata?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (data.error) { setNote({ kind: 'err', text: data.error }); return; }
      const m = data.meta;
      if (m.title) setTitle(m.title);
      if (m.source) setSource(m.source);
      if (m.publishedAt) setPostedAt(toLocalInput(m.publishedAt));
      setNote({ kind: 'ok', text: m.title ? `Pulled the headline${m.source ? ` from ${m.source}` : ''}. Review and add.` : 'Opened the page but found no headline — fill it in below.' });
    } catch {
      setNote({ kind: 'err', text: "Couldn't fetch that link. Fill the fields in by hand." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={saveIndustryLink} className="card h-fit space-y-3 p-5 lg:col-span-1">
      <div>
        <h2 className="font-semibold">Add a link</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Paste the article link and let it fill the rest in.</p>
      </div>

      <div>
        <label className="label">Article link</label>
        <div className="flex gap-2">
          <input name="url" required value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchMeta(); } }}
            className="input flex-1" placeholder="https://reuters.com/…" autoComplete="off" />
          <button type="button" onClick={fetchMeta} disabled={busy} className="btn-outline btn-sm shrink-0 whitespace-nowrap">
            {busy ? 'Fetching…' : 'Fetch details'}
          </button>
        </div>
        {note && (
          <p className={`mt-1.5 text-xs ${note.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{note.text}</p>
        )}
      </div>

      <div><label className="label">Headline</label><input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Fed signals rate cut as inflation cools" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Source</label><input name="source" value={source} onChange={(e) => setSource(e.target.value)} className="input" placeholder="Reuters" /><p className="mt-1 text-xs text-[var(--muted)]">Blank = the link&apos;s domain.</p></div>
        <div><label className="label">Order</label><input name="order" type="number" defaultValue={0} className="input" /></div>
      </div>
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="label">Posted date/time</label>
          <input name="postedAt" type="datetime-local" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} className="input" />
        </div>
        <label className="mb-2.5 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked className="h-4 w-4" /> Active</label>
      </div>

      <button className="btn-primary w-full">Add link</button>
    </form>
  );
}
